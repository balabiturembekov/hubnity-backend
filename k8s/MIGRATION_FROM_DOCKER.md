# Миграция с Docker Compose на Kubernetes (с сохранением данных)

## Текущие пути к данным на сервере

| Volume | Путь на хосте |
|--------|---------------|
| PostgreSQL | `/var/lib/docker/volumes/timetracker-postgres-data/_data` |
| Redis | `/var/lib/docker/volumes/timetracker-redis-data/_data` |
| Uploads | `/var/lib/docker/volumes/timetracker-uploads-data/_data` |

## Важно

- Миграция требует **остановки** текущих Docker-контейнеров
- Запланируйте **окно обслуживания** (15–30 минут простоя)
- Сделайте **бэкап** перед миграцией
- PostgreSQL в Docker использует `PGDATA=/var/lib/postgresql/data/pgdata` — манифесты это учитывают

---

## Шаг 1. Бэкап (на сервере)

```bash
cd ~/hubnity-backend

# Бэкап PostgreSQL
docker exec time-tracker-postgres pg_dumpall -U postgres > backup_$(date +%Y%m%d_%H%M%S).sql

# Бэкап volumes (опционально)
sudo tar -czvf volumes_backup_$(date +%Y%m%d).tar.gz \
  /var/lib/docker/volumes/timetracker-postgres-data/_data \
  /var/lib/docker/volumes/timetracker-redis-data/_data \
  /var/lib/docker/volumes/timetracker-uploads-data/_data
```

---

## Шаг 2. Остановить Docker Compose

```bash
cd ~/hubnity-backend
docker compose down
```

Данные в volumes остаются на диске.

---

## Шаг 3. Установить Kubernetes (k3s)

```bash
curl -sfL https://get.k3s.io | sh -
sudo kubectl get nodes  # проверить
```

---

## Шаг 4. Установить nginx-ingress

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/baremetal/deploy.yaml
kubectl wait --namespace ingress-nginx --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller --timeout=120s
```

---

## Шаг 5. Создать namespace, ConfigMap, Secrets

```bash
cd ~/hubnity-backend

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml

# Секреты — подставьте значения из .env
kubectl create secret generic hubnity-secrets \
  --namespace=hubnity \
  --from-literal=POSTGRES_PASSWORD='...' \
  --from-literal=JWT_SECRET='...' \
  --from-literal=DATABASE_URL='postgresql://postgres:...@hubnity-postgres:5432/timetracker?schema=public' \
  --from-literal=REDIS_PASSWORD=''
```

---

## Шаг 6. Применить PV/PVC с hostPath (существующие данные)

```bash
kubectl apply -f k8s/production-hostpath/postgres-pv-pvc.yaml
kubectl apply -f k8s/production-hostpath/redis-pv-pvc.yaml
kubectl apply -f k8s/production-hostpath/uploads-pv-pvc.yaml
```

Проверка:
```bash
kubectl get pv
kubectl get pvc -n hubnity
```

---

## Шаг 7. Развернуть PostgreSQL, Redis, Backend

```bash
kubectl apply -f k8s/production-hostpath/postgres.yaml
kubectl apply -f k8s/production-hostpath/redis.yaml

kubectl wait --for=condition=ready pod -l app=hubnity-postgres -n hubnity --timeout=120s
kubectl wait --for=condition=ready pod -l app=hubnity-redis -n hubnity --timeout=60s

kubectl apply -f k8s/production-hostpath/backend.yaml
kubectl rollout status deployment/hubnity-backend -n hubnity --timeout=300s
```

---

## Шаг 8. Ingress и DNS

```bash
kubectl apply -f k8s/ingress.yaml
```

Настроить DNS: A-запись `app.automatonsoft.com` → IP сервера (или LoadBalancer Ingress).

---

## Откат (если что-то пошло не так)

```bash
kubectl delete namespace hubnity
kubectl delete pv hubnity-postgres-pv hubnity-redis-pv hubnity-uploads-pv  # если нужно

cd ~/hubnity-backend
docker compose up -d
```
