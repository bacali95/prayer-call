.PHONY: build release

build:
	cd frontend && yarn build

release:
	git add VERSION && \
	git commit -m "Release v$(cat VERSION | tr -d '[:space:]')" && \
	git tag "v$(cat VERSION | tr -d '[:space:]')" && \
	git push --tags