// Package main is the entry point for the Niubility server.
package main

import (
	"context"
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

	ctx := context.Background()
	svc, err := service.New(ctx, cfg.Driver, cfg.DSN)
	if err != nil {
		log.Fatalf("init service: %v", err)
	}

	engine := fox.Default()
	ctrl := handler.New(svc)
	ctrl.RegisterRoutes(engine)

	log.Printf("server starting on %s", cfg.Addr)
	if err := engine.Run(cfg.Addr); err != nil {
		log.Fatalf("server run: %v", err)
	}
}
