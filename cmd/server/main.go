// Package main is the entry point for the Niubility server.
package main

import (
	"flag"
	"log"

	"github.com/fox-gonic/fox"

	"github.com/miclle/niubility/internal/config"
	"github.com/miclle/niubility/internal/handler"
	"github.com/miclle/niubility/internal/service"
)

func main() {
	configPath := flag.String("c", "config.yaml", "path to config file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	svc, err := service.New(cfg.Database.DSN)
	if err != nil {
		log.Fatalf("init service: %v", err)
	}

	engine := fox.Default()
	ctrl := handler.New(svc, cfg.Server.Secret)
	ctrl.RegisterRoutes(engine)

	log.Printf("server starting on %s", cfg.Server.Address)
	if err := engine.Run(cfg.Server.Address); err != nil {
		log.Fatalf("server run: %v", err)
	}
}
