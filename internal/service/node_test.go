package service

import (
	"context"
	"testing"
	"time"

	"github.com/miclle/niubility/internal/entity"
)

func TestService_UpsertServiceNodeHeartbeat_CreatesAndUpdatesNode(t *testing.T) {
	s := setupTestService(t)
	now := time.Date(2026, 4, 10, 12, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return now }
	s.nodeHeartbeatTimeout = 90 * time.Second

	ctx := context.Background()
	startedAt := now.Add(-5 * time.Minute)

	if err := s.UpsertServiceNodeHeartbeat(ctx, ServiceNodeHeartbeatInput{
		NodeID:       "web-1",
		NodeType:     entity.NodeTypeWeb,
		DisplayName:  "Web-1",
		Version:      "v1.0.0",
		GitCommit:    "abc123",
		BuildTime:    "2026-04-10-19-30-00",
		StartedAt:    &startedAt,
		Hostname:     "host-1",
		InstanceIP:   "10.0.0.1",
		ListenAddr:   "0.0.0.0:9000",
		Environment:  "prod",
		Region:       "cn-east-1",
		Zone:         "az1",
		Capabilities: []string{"http", "upload"},
		Meta:         map[string]string{"go_version": "go1.25.0"},
	}); err != nil {
		t.Fatalf("UpsertServiceNodeHeartbeat() create error = %v", err)
	}

	var created entity.ServiceNode
	if err := s.db.WithContext(ctx).Where("node_id = ?", "web-1").First(&created).Error; err != nil {
		t.Fatalf("query created node error = %v", err)
	}
	if created.ID == "" {
		t.Fatal("expected created node to have id")
	}
	if created.ServiceName != "niubility" {
		t.Fatalf("ServiceName = %q, want niubility", created.ServiceName)
	}
	if created.LastHeartbeatAt != now {
		t.Fatalf("LastHeartbeatAt = %v, want %v", created.LastHeartbeatAt, now)
	}

	nextNow := now.Add(30 * time.Second)
	s.now = func() time.Time { return nextNow }

	if err := s.UpsertServiceNodeHeartbeat(ctx, ServiceNodeHeartbeatInput{
		NodeID:       "web-1",
		NodeType:     entity.NodeTypeWeb,
		DisplayName:  "Web-1A",
		Version:      "v1.0.1",
		GitCommit:    "def456",
		BuildTime:    "2026-04-10-19-40-00",
		StartedAt:    &startedAt,
		Hostname:     "host-1a",
		InstanceIP:   "10.0.0.2",
		ListenAddr:   "0.0.0.0:9000",
		Environment:  "prod",
		Region:       "cn-east-1",
		Zone:         "az2",
		Capabilities: []string{"http"},
		Meta:         map[string]string{"go_version": "go1.25.1"},
	}); err != nil {
		t.Fatalf("UpsertServiceNodeHeartbeat() update error = %v", err)
	}

	var updated entity.ServiceNode
	if err := s.db.WithContext(ctx).Where("node_id = ?", "web-1").First(&updated).Error; err != nil {
		t.Fatalf("query updated node error = %v", err)
	}
	if updated.ID != created.ID {
		t.Fatalf("updated ID = %q, want %q", updated.ID, created.ID)
	}
	if updated.Version != "v1.0.1" || updated.GitCommit != "def456" {
		t.Fatalf("updated version info = %q/%q", updated.Version, updated.GitCommit)
	}
	if updated.LastHeartbeatAt != nextNow {
		t.Fatalf("updated LastHeartbeatAt = %v, want %v", updated.LastHeartbeatAt, nextNow)
	}
}

func TestService_ListServiceNodes_GroupsStatusAndDetectsVersionDrift(t *testing.T) {
	s := setupTestService(t)
	now := time.Date(2026, 4, 10, 12, 0, 0, 0, time.UTC)
	s.now = func() time.Time { return now }
	s.nodeHeartbeatTimeout = 90 * time.Second

	ctx := context.Background()
	webStartedAt := now.Add(-2 * time.Hour)
	workerStartedAt := now.Add(-1 * time.Hour)
	schedulerStartedAt := now.Add(-30 * time.Minute)

	nodes := []entity.ServiceNode{
		{
			ID:              entity.ID(),
			NodeID:          "web-1",
			NodeType:        entity.NodeTypeWeb,
			ServiceName:     "niubility",
			DisplayName:     "Web-1",
			Version:         "v1.0.0",
			GitCommit:       "abc123",
			StartedAt:       &webStartedAt,
			LastHeartbeatAt: now.Add(-10 * time.Second),
			Hostname:        "host-web-1",
			Capabilities:    []string{"http"},
		},
		{
			ID:              entity.ID(),
			NodeID:          "worker-1",
			NodeType:        entity.NodeTypeWorker,
			ServiceName:     "niubility",
			DisplayName:     "Worker-1",
			Version:         "v1.0.1",
			GitCommit:       "def456",
			StartedAt:       &workerStartedAt,
			LastHeartbeatAt: now.Add(-20 * time.Second),
			Hostname:        "host-worker-1",
			Capabilities:    []string{"queue", "wechat-sync"},
		},
		{
			ID:              entity.ID(),
			NodeID:          "scheduler-1",
			NodeType:        entity.NodeTypeScheduler,
			ServiceName:     "niubility",
			DisplayName:     "Scheduler-1",
			Version:         "v1.0.1",
			GitCommit:       "def456",
			StartedAt:       &schedulerStartedAt,
			LastHeartbeatAt: now.Add(-5 * time.Minute),
			Hostname:        "host-scheduler-1",
			Capabilities:    []string{"cron"},
		},
	}

	if err := s.db.WithContext(ctx).Create(&nodes).Error; err != nil {
		t.Fatalf("seed nodes error = %v", err)
	}

	result, err := s.ListServiceNodes(ctx, ListServiceNodesInput{})
	if err != nil {
		t.Fatalf("ListServiceNodes() error = %v", err)
	}

	if len(result.OnlineItems) != 2 {
		t.Fatalf("len(OnlineItems) = %d, want 2", len(result.OnlineItems))
	}
	if len(result.OfflineItems) != 1 {
		t.Fatalf("len(OfflineItems) = %d, want 1", len(result.OfflineItems))
	}
	if result.OnlineItems[0].NodeID != "web-1" || result.OnlineItems[1].NodeID != "worker-1" {
		t.Fatalf("online order = [%s, %s], want [web-1, worker-1]", result.OnlineItems[0].NodeID, result.OnlineItems[1].NodeID)
	}
	if result.OfflineItems[0].NodeID != "scheduler-1" {
		t.Fatalf("offline node = %s, want scheduler-1", result.OfflineItems[0].NodeID)
	}
	if result.Summary.OnlineCount != 2 || result.Summary.OfflineCount != 1 {
		t.Fatalf("summary counts = %d/%d, want 2/1", result.Summary.OnlineCount, result.Summary.OfflineCount)
	}
	if !result.Summary.VersionDrift {
		t.Fatal("expected VersionDrift to be true")
	}
	if result.OnlineItems[0].UptimeSeconds <= 0 {
		t.Fatalf("online item uptime = %d, want > 0", result.OnlineItems[0].UptimeSeconds)
	}
	if result.Summary.TypeCounts[entity.NodeTypeWeb] != 1 || result.Summary.TypeCounts[entity.NodeTypeWorker] != 1 || result.Summary.TypeCounts[entity.NodeTypeScheduler] != 1 {
		t.Fatalf("type counts = %#v", result.Summary.TypeCounts)
	}
}
