# Environment Check — kubectl Commands

Run these commands **before deploying** to verify your cluster is ready for Hubnity Backend.

## 1. Namespace

```bash
# List all namespaces
kubectl get namespaces

# Check if hubnity namespace exists
kubectl get namespace hubnity

# Create hubnity namespace if missing
kubectl apply -f k8s/namespace.yaml
```

## 2. StorageClass (for PVCs, migrations, logs)

```bash
# List available StorageClasses
kubectl get storageclass

# Show default StorageClass (marked with (default))
kubectl get storageclass -o wide

# Inspect a specific StorageClass
kubectl describe storageclass <storage-class-name>
```

**Note:** If no StorageClass exists, PVCs may stay in `Pending` state. On cloud providers (GKE, EKS, AKS, DOKS), a default StorageClass is usually present. For minikube, run `minikube addons enable default-storageclass`.

## 3. Ingress Controller (Nginx vs Traefik)

```bash
# List Ingress controllers (pods in ingress-related namespaces)
kubectl get pods -n ingress-nginx
kubectl get pods -n traefik

# Check IngressClass resources
kubectl get ingressclass

# Inspect Ingress controller type
kubectl get ingressclass -o wide
```

**Nginx Ingress:** Look for `ingress-nginx` namespace and `nginx` IngressClass.  
**Traefik:** Look for `traefik` namespace and `traefik` IngressClass.

Our manifests use `ingressClassName: nginx`. If you use Traefik, adjust the Ingress annotations accordingly.

## 4. Quick Health Check (all-in-one)

```bash
# One-liner: namespace + storage + ingress
kubectl get ns hubnity 2>/dev/null || echo "Namespace hubnity missing"
kubectl get storageclass
kubectl get ingressclass
kubectl get pods -n ingress-nginx 2>/dev/null || kubectl get pods -n traefik 2>/dev/null || echo "No ingress controller found"
```
