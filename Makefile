.PHONY: build push deploy clean docker-build docker-run k8s-deploy k8s-delete

# Docker image name
IMAGE_NAME ?= prayer-call
IMAGE_TAG ?= latest
REGISTRY ?= localhost:3001

# Build Docker image
docker-build:
	docker build -t $(IMAGE_NAME):$(IMAGE_TAG) .

# Run Docker container locally
docker-run:
	docker run -p 3001:3001 \
		-v $(PWD)/config.json:/app/config.json \
		-v $(PWD)/uploads:/app/uploads \
		$(IMAGE_NAME):$(IMAGE_TAG)

# Build and push to registry
build-push: docker-build
	docker tag $(IMAGE_NAME):$(IMAGE_TAG) $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)
	docker push $(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG)

# Deploy to Kubernetes
k8s-deploy:
	kubectl apply -k k8s/

# Delete Kubernetes resources
k8s-delete:
	kubectl delete -k k8s/

# Update image in deployment
k8s-update-image:
	kubectl set image deployment/prayer-call prayer-call=$(REGISTRY)/$(IMAGE_NAME):$(IMAGE_TAG) -n prayer-call

# View logs
k8s-logs:
	kubectl logs -f deployment/prayer-call -n prayer-call

# Port forward to access locally
k8s-port-forward:
	kubectl port-forward service/prayer-call-service 3001:80 -n prayer-call

# Clean up
clean:
	docker rmi $(IMAGE_NAME):$(IMAGE_TAG) || true

