# Пошаговая инструкция: Деплой Hubnity Backend в Kubernetes

> **Миграция с Docker Compose:** если у вас уже есть данные в Docker volumes, см. [MIGRATION_FROM_DOCKER.md](./MIGRATION_FROM_DOCKER.md).

## Где выполнять команды?

**Вариант 1 — с вашего компьютера (рекомендуется)**  
- Установите `kubectl` на Mac/Windows/Linux  
- Скачайте kubeconfig с панели облака (DigitalOcean, GKE и т.п.) или с сервера  
- Команды выполняйте в терминале на своём компьютере — они будут обращаться к кластеру по сети  

**Вариант 2 — на сервере с Kubernetes**  
- Подключитесь по SSH к серверу, где установлен Kubernetes  
- Выполняйте команды прямо на сервере (если `kubectl` и kubeconfig уже настроены)  

**Вариант 3 — minikube локально**  
- Запустите minikube на своём компьютере  
- Все команды выполняются локально для тестового кластера  

---

## Шаг 0. Подготовка (если кластера ещё нет)

**Вариант A — локально (minikube):**
```bash
minikube start
kubectl cluster-info
```

**Вариант B — облако (DigitalOcean, GKE, EKS, AKS):**
- Создайте кластер в панели провайдера
- Скачайте kubeconfig и настройте: `export KUBECONFIG=~/path/to/kubeconfig`

---

## Шаг 1. Установить nginx-ingress controller

Без Ingress внешний трафик не попадёт в кластер.

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.9.4/deploy/static/provider/cloud/deploy.yaml
```

Подождите, пока controller станет Ready:
```bash
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

---

## Шаг 2. Создать namespace и ConfigMap

```bash
cd /путь/к/hubnity-backend

kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
```

Проверка:
```bash
kubectl get ns hubnity
kubectl get configmap -n hubnity
```

---

## Шаг 3. Создать секреты

Подставьте свои значения вместо `your_postgres_password` и `your_jwt_secret`:

```bash
kubectl create secret generic hubnity-secrets \
  --namespace=hubnity \
  --from-literal=POSTGRES_PASSWORD='your_postgres_password' \
  --from-literal=JWT_SECRET='your_jwt_secret' \
  --from-literal=DATABASE_URL='postgresql://postgres:your_postgres_password@hubnity-postgres:5432/timetracker?schema=public' \
  --from-literal=REDIS_PASSWORD=''
```

Проверка:
```bash
kubectl get secret hubnity-secrets -n hubnity
```

---

## Шаг 4. Развернуть PostgreSQL и Redis

```bash
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
```

Дождитесь готовности подов:
```bash
kubectl wait --for=condition=ready pod -l app=hubnity-postgres -n hubnity --timeout=120s
kubectl wait --for=condition=ready pod -l app=hubnity-redis -n hubnity --timeout=60s
```

Проверка:
```bash
kubectl get pods -n hubnity
kubectl get svc -n hubnity
```

---

## Шаг 5. (Опционально) Доступ к образу в ghcr.io

Если пакет **приватный**, создайте secret и раскомментируйте `imagePullSecrets` в `k8s/backend.yaml`:

```bash
kubectl create secret docker-registry ghcr-secret \
  --namespace=hubnity \
  --docker-server=ghcr.io \
  --docker-username=ВАШ_GITHUB_USERNAME \
  --docker-password=ВАШ_GITHUB_PAT \
  --docker-email=ваш@email.com
```

Если пакет **публичный** — этот шаг можно пропустить.

---

## Шаг 6. Развернуть Backend

```bash
kubectl apply -f k8s/backend.yaml
```

Дождитесь готовности:
```bash
kubectl rollout status deployment/hubnity-backend -n hubnity --timeout=300s
```

Проверка:
```bash
kubectl get pods -n hubnity
kubectl logs -l app=hubnity-backend -n hubnity -f
```

---

## Шаг 7. Развернуть Ingress

```bash
kubectl apply -f k8s/ingress.yaml
```

Проверка:
```bash
kubectl get ingress -n hubnity
```

---

## Шаг 8. Настроить DNS

Укажите DNS-запись для `app.automatonsoft.com` на внешний IP Ingress:

```bash
kubectl get ingress -n hubnity
```

Скопируйте `ADDRESS` и создайте A-запись для `app.automatonsoft.com` → этот IP.

---

## Шаг 9. Проверить работу

```bash
curl https://app.automatonsoft.com/api
```

Если всё настроено — должен вернуться JSON (например, информация об API).

---

## Шаг 10. Настроить GitHub Actions для автоматического деплоя

1. Откройте репозиторий на GitHub → **Settings** → **Secrets and variables** → **Actions**.

2. Добавьте secret:
   - **Name:** `KUBE_CONFIG`
   - **Value:** результат команды (закодированный kubeconfig):

   ```bash
   cat ~/.kube/config | base64 -w0
   ```

   macOS:
   ```bash
   cat ~/.kube/config | base64
   ```

3. Добавьте secret в **Environment** `staging`:
   - **Settings** → **Environments** → **staging** → **Environment secrets**
   - Добавьте `KUBE_CONFIG` с тем же значением

4. После push в `main` workflow обновит образ в staging автоматически.

---

## Полезные команды

| Действие | Команда |
|----------|---------|
| Просмотр подов | `kubectl get pods -n hubnity` |
| Логи backend | `kubectl logs -l app=hubnity-backend -n hubnity -f` |
| Перезапуск backend | `kubectl rollout restart deployment/hubnity-backend -n hubnity` |
| Обновить образ вручную | `kubectl set image deployment/hubnity-backend backend=ghcr.io/balabiturembekov/hubnity-backend:main -n hubnity` |
| Удалить всё | `kubectl delete namespace hubnity` |
