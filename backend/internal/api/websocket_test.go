package api

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/fasthttp/websocket"
	fiber_websocket "github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/waluyo/wapbolt-backend/internal/repository"
)

func resetWSHub() {
	WSHub.mu.Lock()
	defer WSHub.mu.Unlock()
	WSHub.Clients = make(map[uint]map[*Client]bool)
	WSHub.Locks = make(map[uint]LockInfo)
}

func TestHub_RegisterUnregister(t *testing.T) {
	resetWSHub()
	
	client := &Client{
		UserID:   1,
		UserName: "TestUser",
		TeamID:   1,
		Conn:     &fiber_websocket.Conn{}, // dummy
	}

	WSHub.Register(client)
	
	WSHub.mu.RLock()
	assert.True(t, WSHub.Clients[1][client])
	WSHub.mu.RUnlock()

	WSHub.Unregister(client)

	WSHub.mu.RLock()
	assert.Empty(t, WSHub.Clients[1])
	WSHub.mu.RUnlock()
}

func TestHub_UnregisterWithLock(t *testing.T) {
	resetWSHub()
	
	client := &Client{
		UserID:   1,
		UserName: "TestUser",
		TeamID:   1,
		Conn:     &fiber_websocket.Conn{}, // dummy
	}

	WSHub.Register(client)
	
	WSHub.mu.Lock()
	WSHub.Locks[100] = LockInfo{
		UserID:   1,
		UserName: "TestUser",
		ExpireAt: time.Now().Add(1 * time.Minute),
	}
	WSHub.mu.Unlock()

	WSHub.Unregister(client)

	WSHub.mu.RLock()
	_, exists := WSHub.Locks[100]
	assert.False(t, exists, "Lock should be released on unregister")
	WSHub.mu.RUnlock()
}

func TestHub_CleanupExpiredLocks(t *testing.T) {
	resetWSHub()
	
	WSHub.mu.Lock()
	WSHub.Locks[300] = LockInfo{
		UserID:   1,
		UserName: "User1",
		ExpireAt: time.Now().Add(-1 * time.Second), // Expired
	}
	WSHub.Locks[301] = LockInfo{
		UserID:   2,
		UserName: "User2",
		ExpireAt: time.Now().Add(1 * time.Minute), // Not expired
	}
	WSHub.mu.Unlock()

	WSHub.CleanupExpiredLocks()

	WSHub.mu.RLock()
	_, exists300 := WSHub.Locks[300]
	_, exists301 := WSHub.Locks[301]
	assert.False(t, exists300)
	assert.True(t, exists301)
	WSHub.mu.RUnlock()
}

func TestHub_SendLockStatus_Nil(t *testing.T) {
	resetWSHub()
	client := &Client{
		UserID: 1,
		Conn:   &fiber_websocket.Conn{}, // dummy
	}
	// This should not panic and should send a nil payload
	WSHub.SendLockStatus(client, 999)
}

func TestHub_CleanupExpiredLocks_Broadcast(t *testing.T) {
	resetWSHub()
	
	WSHub.mu.Lock()
	WSHub.Locks[400] = LockInfo{
		UserID:   1,
		UserName: "User1",
		ExpireAt: time.Now().Add(-1 * time.Second), // Expired
	}
	// Add a client to a team to test broadcast
	WSHub.Clients[10] = make(map[*Client]bool)
	WSHub.mu.Unlock()

	WSHub.CleanupExpiredLocks()

	WSHub.mu.RLock()
	assert.Empty(t, WSHub.Locks)
	WSHub.mu.RUnlock()
}

func TestWebSocket_Middleware(t *testing.T) {
	app := fiber.New()
	SetupWebSocketRoutes(app)

	// Call /ws via normal HTTP
	req, _ := http.NewRequest("GET", "/ws", nil)
	req.Host = "localhost"
	resp, err := app.Test(req)
	require.NoError(t, err)
	assert.Equal(t, http.StatusUpgradeRequired, resp.StatusCode)
}

func TestLogActivity_Coverage(t *testing.T) {
	mock, cleanup := repository.SetupTestDB()
	defer cleanup()

	// Test with nil details
	mock.ExpectBegin()
	mock.ExpectQuery("^INSERT INTO \"activity_logs\"").
		WithArgs(uint(1), uint(1), "ACTION", "TYPE", uint(10), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow(1))
	mock.ExpectCommit()

	LogActivity(repository.DB, 1, 1, "ACTION", "TYPE", 10, nil)
	
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestBroadcastMethods_Coverage(t *testing.T) {
	resetWSHub()
	
	// Broadcast with no clients
	WSHub.BroadcastPresence(1, 100)
	WSHub.BroadcastLockUpdate(1, 100)
	WSHub.BroadcastEntityUpdate(1, "TYPE", 1)
}

func TestWebSocketFullCycle(t *testing.T) {
	resetWSHub()
	
	app := fiber.New()
	SetupWebSocketRoutes(app)

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	
	port := ln.Addr().(*net.TCPAddr).Port
	go app.Listener(ln)
	defer app.Shutdown()

	// Wait for server to start
	time.Sleep(100 * time.Millisecond)

	url1 := fmt.Sprintf("ws://127.0.0.1:%d/ws?user_id=1&team_id=10&user_name=User1", port)
	url2 := fmt.Sprintf("ws://127.0.0.1:%d/ws?user_id=2&team_id=10&user_name=User2", port)
	
	dialer := websocket.Dialer{}
	conn1, _, err := dialer.Dial(url1, nil)
	require.NoError(t, err)
	defer conn1.Close()

	conn2, _, err := dialer.Dial(url2, nil)
	require.NoError(t, err)
	defer conn2.Close()

	// Helper to write events
	sendEvent := func(conn *websocket.Conn, event WSEvent) {
		msg, _ := json.Marshal(event)
		conn.WriteMessage(websocket.TextMessage, msg)
	}

	// 1. Join Request
	sendEvent(conn1, WSEvent{Type: EventJoinRequest, RequestID: 500})
	sendEvent(conn2, WSEvent{Type: EventJoinRequest, RequestID: 500})
	
	// Join another request for User 1
	sendEvent(conn1, WSEvent{Type: EventJoinRequest, RequestID: 600})

	// 2. Lock Request
	sendEvent(conn1, WSEvent{Type: EventLockRequest, RequestID: 500})
	time.Sleep(50 * time.Millisecond)
	sendEvent(conn2, WSEvent{Type: EventLockRequest, RequestID: 500}) // Should fail as User1 holds it

	// 3. Unlock Request
	sendEvent(conn2, WSEvent{Type: EventUnlockRequest, RequestID: 500}) // Should fail as User1 holds it
	sendEvent(conn1, WSEvent{Type: EventUnlockRequest, RequestID: 500})

	// 4. Leave Request
	sendEvent(conn1, WSEvent{Type: EventLeaveRequest})

	// 5. Invalid JSON
	conn1.WriteMessage(websocket.TextMessage, []byte("invalid json"))

	// 6. Lock Ownership Renewal & Expiry Renewal
	sendEvent(conn1, WSEvent{Type: EventLockRequest, RequestID: 700})
	time.Sleep(50 * time.Millisecond)
	sendEvent(conn1, WSEvent{Type: EventLockRequest, RequestID: 700}) // Renew

	// 7. Cleanup & Broadcasts
	WSHub.BroadcastEntityUpdate(10, "REQUEST", 100)
	
	// Wait for processing
	time.Sleep(200 * time.Millisecond)
}

func TestWebSocket_InvalidParams(t *testing.T) {
	app := fiber.New()
	SetupWebSocketRoutes(app)

	ln, _ := net.Listen("tcp", "127.0.0.1:0")
	port := ln.Addr().(*net.TCPAddr).Port
	go app.Listener(ln)
	defer app.Shutdown()
	time.Sleep(100 * time.Millisecond)

	// Missing user_id
	url := fmt.Sprintf("ws://127.0.0.1:%d/ws?team_id=10", port)
	dialer := websocket.Dialer{}
	conn, _, err := dialer.Dial(url, nil)
	if err == nil {
		_, _, err = conn.ReadMessage()
		assert.Error(t, err, "Connection should be closed for invalid params")
		conn.Close()
	}

	// Missing team_id
	url = fmt.Sprintf("ws://127.0.0.1:%d/ws?user_id=1", port)
	conn, _, err = dialer.Dial(url, nil)
	if err == nil {
		_, _, err = conn.ReadMessage()
		assert.Error(t, err, "Connection should be closed for invalid params")
		conn.Close()
	}
}
