// Package main is the entry point for the Niubility server.
package main

import (
	"context"
	"flag"
	"log"
	"os"
	"strings"
	"time"

	"github.com/fox-gonic/fox"

	"github.com/miclle/niubility/internal/config"
	"github.com/miclle/niubility/internal/entity"
	"github.com/miclle/niubility/internal/handler"
	"github.com/miclle/niubility/internal/service"
)

var (
	CommitID  = "dev"
	BuildTime = ""
)

func main() {
	configPath := flag.String("c", "config.yaml", "path to config file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatalf("load config: %v", err)
	}

	ctx := context.Background()
	svc, err := service.New(ctx, cfg.Driver, cfg.DSN.Value())
	if err != nil {
		log.Fatalf("init service: %v", err)
	}
	svc.StartCurrentNodeHeartbeat(ctx, service.CurrentNodeConfig{
		NodeID:            resolveNodeID(cfg.Addr),
		NodeType:          resolveNodeType(),
		ServiceName:       envOrDefault("NIUBILITY_NODE_SERVICE_NAME", "niubility"),
		DisplayName:       os.Getenv("NIUBILITY_NODE_DISPLAY_NAME"),
		Version:           envOrDefault("NIUBILITY_NODE_VERSION", CommitID),
		GitCommit:         CommitID,
		BuildTime:         BuildTime,
		ListenAddr:        cfg.Addr,
		Environment:       os.Getenv("NIUBILITY_NODE_ENV"),
		Region:            os.Getenv("NIUBILITY_NODE_REGION"),
		Zone:              os.Getenv("NIUBILITY_NODE_ZONE"),
		Capabilities:      splitCSV(os.Getenv("NIUBILITY_NODE_CAPABILITIES")),
		Meta:              map[string]string{"build_time": BuildTime},
		HeartbeatInterval: 30 * time.Second,
	})

	engine := fox.Default()
	ctrl := handler.New(svc)
	ctrl.RegisterRoutes(engine)

	log.Printf("server starting on %s", cfg.Addr)
	if err := engine.Run(cfg.Addr); err != nil {
		log.Fatalf("server run: %v", err)
	}
}

func resolveNodeID(addr string) string {
	if value := strings.TrimSpace(os.Getenv("NIUBILITY_NODE_ID")); value != "" {
		return value
	}
	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "unknown-host"
	}
	nodeType := resolveNodeType()
	return hostname + ":" + nodeType + ":" + strings.TrimSpace(addr)
}

func resolveNodeType() string {
	nodeType := strings.TrimSpace(os.Getenv("NIUBILITY_NODE_TYPE"))
	switch nodeType {
	case entity.NodeTypeWorker, entity.NodeTypeScheduler:
		return nodeType
	default:
		return entity.NodeTypeWeb
	}
}

func splitCSV(value string) []string {
	if value == "" {
		return nil
	}
	parts := strings.Split(value, ",")
	items := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part != "" {
			items = append(items, part)
		}
	}
	return items
}

func envOrDefault(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}
