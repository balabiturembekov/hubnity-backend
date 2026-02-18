# Деплой Hubnity Backend

## Workflow

1. **Локально:** вносите изменения → `git push`
2. **На сервере:** `git pull` → `./scripts/deploy.sh --pull`

Backend обновится в фоне без простоя (rolling update).

---

## Требования на сервере

- Docker (с доступом к ghcr.io)
- kubectl (настроен на кластер)
- Репозиторий склонирован

---

## Команды

```bash
# Полный цикл: pull + build + push + rollout
./scripts/deploy.sh --pull

# Только build + push + rollout (если уже сделали git pull)
./scripts/deploy.sh
```

---

## Переменные окружения

| Переменная | По умолчанию | Описание |
|------------|--------------|----------|
| IMAGE | ghcr.io/balabiturembekov/hubnity-backend | Реестр и имя образа |
| IMAGE_TAG | latest | Тег образа |
| NAMESPACE | hubnity | Namespace в Kubernetes |

Пример с версией:

```bash
IMAGE_TAG=v1.2.3 ./scripts/deploy.sh --pull
```

---

## Zero-downtime

Deployment настроен с `maxUnavailable: 0` — новый под поднимается до завершения старого. Web и desktop клиенты продолжают работать во время обновления.
