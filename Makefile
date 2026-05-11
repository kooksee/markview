PKG = github.com/kooksee/markview
COMMIT = $(shell git rev-parse --short HEAD)

BUILD_LDFLAGS = "-s -w -X $(PKG)/version.Revision=$(COMMIT)"

default: test

ci: depsdev generate test

generate:
	go generate ./internal/static/

test:
	cd frontend && sh scripts/pnpm-install-safe.sh && pnpm run test:coverage
	go test ./... -coverprofile=coverage.out -covermode=count -count=1

build: generate
	go build -ldflags=$(BUILD_LDFLAGS) -trimpath -o markview .

install: generate
	go install -ldflags=$(BUILD_LDFLAGS) -trimpath .

dev: build
	./markview -p 16275 --foreground $(ARGS)

screenshot: build
	cd frontend && pnpm run screenshots

lint:
	cd frontend && sh scripts/pnpm-install-safe.sh && pnpm run lint
	golangci-lint run ./...
	go vet -vettool=`which gostyle` -gostyle.config=$(PWD)/.gostyle.yml ./...

fmt:
	cd frontend && sh scripts/pnpm-install-safe.sh && pnpm run fmt

fmt-check:
	cd frontend && sh scripts/pnpm-install-safe.sh && pnpm run fmt:check

depsdev:
	go install github.com/Songmu/gocredits/cmd/gocredits@latest
	go install github.com/k1LoW/gostyle@latest

credits: depsdev generate
	go mod download
	gocredits -w .
	cd frontend && MARKVIEW_BUILD_CREDITS=1 pnpm run build
	printf "\n================================================================\n\n" >> CREDITS
	cat frontend/CREDITS_FRONTEND >> CREDITS

prerelease_for_tagpr: credits
	git add CHANGELOG.md CREDITS go.mod go.sum

.PHONY: default ci generate test build dev screenshot lint fmt fmt-check depsdev credits prerelease_for_tagpr
