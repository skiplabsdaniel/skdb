
SHELL := /bin/bash

SKARGO_PROFILE?=release

SCRIPT_DIR=$(shell dirname $(shell realpath $(firstword $(MAKEFILE_LIST))))
PRIVACY=$(realpath ../sql/privacy/init.sql)
DATABASES=$(realpath ./ts/examples/databases/)
SKDB=../sql/target/host/$(SKARGO_PROFILE)/skdb
INPUTS?=1
NUMBERS:=$(shell seq 1 ${INPUTS})
SDKMAN_DIR?=$(HOME)/.sdkman
SDKMAN_INIT=$(SDKMAN_DIR)/bin/sdkman-init.sh

SERVER_DIR=$(SCRIPT_DIR)/../sql/server/dev
SERVER_JAR=$(SERVER_DIR)/build/libs/dev.jar
SERVER_CONFIG=$(DATABASES)/server.config

$(SERVER_CONFIG):
	@echo "skdb_databases=$(DATABASES)" >> $(SERVER_CONFIG)
	@echo "skdb=$(realpath $(SKDB))" >> $(SERVER_CONFIG)
	@echo "skdb_init=$(PRIVACY)" >> $(SERVER_CONFIG)
	@echo "skstore=true" >> $(SERVER_CONFIG)

.PHONY: build_server
build_server:
	@cd ../sql && skargo b --profile $(SKARGO_PROFILE)
	@cd $(SERVER_DIR) && source $(SDKMAN_INIT) && ../gradlew jar --no-daemon --console plain 1>&2 > $(DATABASES)/build_server.log

define skdb
$(SKDB) --data $(DATABASES)/$(1).db
endef

define exec
echo $(2); echo $(2) | $(call skdb,$(1))
endef

define run_server
source $(SDKMAN_INIT) && java -jar $(SERVER_JAR) --config $(SERVER_CONFIG) &> $(DATABASES)/server.log &
endef

define create_table
$(call exec,$(1),"CREATE TABLE IF NOT EXISTS \"$(2)\" (key JSON PRIMARY KEY,value JSON);")
endef

define create_input
$(call create_table,$(1),input$(2))
endef

clean-%:
	rm $(DATABASES)/$*.db

skdb-%: $(SKDB)
	$(call exec,$*,"$(QUERY)")

../build/sknpm:
	cd .. && make build/sknpm

build-%: ../build/sknpm
	cd ts/examples && bun install
	../build/sknpm b -r --out-dir ts/examples/node_modules/skstore

bunrun-%: ../build/sknpm
	cd ts/examples && bun install
	../build/sknpm b -r --out-dir ts/examples/node_modules/skstore
	bun run ts/examples/wmain.ts -f ts/examples/$*.ts -m io

bunrun-%-m: ../build/sknpm $(SERVER_CONFIG) start 
	cd ts/examples && bun install
	../build/sknpm b -r --out-dir ts/examples/node_modules/skstore
	bun run ts/examples/wmain.ts -f ts/examples/$*.ts -m io -c $*

check-%: ../build/sknpm
	cd ts/examples && npm install
	../build/sknpm b -r --nowasm --out-dir ts/examples/node_modules/skstore
	tsc --project ts/examples/tsconfig.json

noderun-%: ../build/sknpm
	cd ts/examples && npm install
	../build/sknpm b -r --out-dir ts/examples/node_modules/skstore
	tsc --project ts/examples/tsconfig.json
	cd ts/examples && node dist/wmain.js -f dist/$*.js -m io

noderun-%-m: ../build/sknpm  $(SERVER_CONFIG) start
	cd ts/examples && npm install
	../build/sknpm b -r --out-dir ts/examples/node_modules/skstore
	tsc --project ts/examples/tsconfig.json
	cd ts/examples && node dist/wmain.js -f dist/$*.js -m io -c $*

bunplay-%: ../build/sknpm
	cd ts/examples && bun install
	../build/sknpm b -r --out-dir ts/examples/node_modules/skstore
	echo "play 1\nexit\n" | bun run ts/examples/wmain.ts -f ts/examples/$*.ts -m io

nodeplay-%: ../build/sknpm
	cd ts/examples && npm install
	../build/sknpm b -r --out-dir ts/examples/node_modules/skstore
	tsc --project ts/examples/tsconfig.json
	cd ts/examples && echo "play 1\nexit\n" | node dist/wmain.js -f  dist/$*.js -m io

.PHONY: start
start: build_server $(eval SPROCESSES:=$(shell bash -c 'source $(SDKMAN_INIT) && jps' | grep dev.jar | awk '{print $$1}'))
ifeq ($(SPROCESSES),)
	$(call run_server)
else
	@echo "Server already running."
endif


.PHONY: stop
stop: $(eval SPROCESSES:=$(shell bash -c 'source $(SDKMAN_INIT) && jps' | grep dev.jar | awk '{print $$1}'))
ifneq ($(SPROCESSES),)
	kill $(SPROCESSES)
endif

