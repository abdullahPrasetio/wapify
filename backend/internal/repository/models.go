package repository

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"
)

// JSONB is a helper type for PostgreSQL JSONB columns (Objects)
type JSONB map[string]interface{}

func (j JSONB) Value() (driver.Value, error) {
	return json.Marshal(j)
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = make(JSONB)
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(b, j)
}

// JSONBArray is a helper type for PostgreSQL JSONB columns (Arrays)
type JSONBArray []interface{}

func (j JSONBArray) Value() (driver.Value, error) {
	return json.Marshal(j)
}

func (j *JSONBArray) Scan(value interface{}) error {
	if value == nil {
		*j = make(JSONBArray, 0)
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	return json.Unmarshal(b, j)
}

type User struct {
	ID                    uint       `gorm:"primaryKey" json:"id"`
	Email                 string     `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash          string     `gorm:"not null" json:"-"`
	Name                  string     `gorm:"not null" json:"name"`
	IsSuperAdmin          bool       `gorm:"default:false" json:"is_super_admin"`
	RoleSignature         string     `json:"-"`
	LastDonationPromptAt *time.Time `json:"last_donation_prompt_at"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`
}

type Team struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	Description string    `json:"description"`
	CreatedByID *uint     `gorm:"column:created_by" json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`

	CreatedBy *User `gorm:"foreignKey:CreatedByID;references:ID" json:"-"`
}

type TeamMember struct {
	ID       uint      `gorm:"primaryKey" json:"id"`
	TeamID   uint      `gorm:"not null;uniqueIndex:idx_team_user" json:"team_id"`
	UserID   uint      `gorm:"not null;uniqueIndex:idx_team_user" json:"user_id"`
	Role     string    `gorm:"not null" json:"role"`
	JoinedAt time.Time `json:"joined_at"`

	Team *Team `gorm:"foreignKey:TeamID" json:"-"`
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type Collection struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Name        string    `gorm:"not null" json:"name"`
	Description string    `json:"description"`
	TeamID      uint      `gorm:"not null" json:"team_id"`
	CreatedByID *uint     `gorm:"column:created_by" json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`

	Team      *Team `gorm:"foreignKey:TeamID" json:"-"`
	CreatedBy *User `gorm:"foreignKey:CreatedByID;references:ID" json:"-"`
}

type Folder struct {
	ID             uint   `gorm:"primaryKey" json:"id"`
	Name           string `gorm:"not null" json:"name"`
	CollectionID   uint   `gorm:"not null;column:collection_id" json:"collection_id"`
	ParentFolderID *uint  `gorm:"column:parent_folder_id" json:"parent_folder_id"`
	OrderIndex     float64 `gorm:"default:0;column:order_index" json:"order_index"`

	Collection   *Collection `gorm:"foreignKey:CollectionID" json:"-"`
	ParentFolder *Folder     `gorm:"foreignKey:ParentFolderID" json:"-"`
}

type Request struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Name         string    `gorm:"not null" json:"name"`
	Description  string    `json:"description"`
	Method       string    `gorm:"not null" json:"method"`
	URL                string           `gorm:"not null" json:"url"`
	Headers            JSONB            `gorm:"type:jsonb;default:'{}';column:headers" json:"headers"`
	Body               JSONB            `gorm:"type:jsonb;default:'{}';column:body" json:"body"`
	BodyType           string           `gorm:"column:body_type;default:raw-json" json:"body_type"`
	AuthConfig         JSONB            `gorm:"type:jsonb;default:'{}';column:auth_config" json:"auth_config"`
	CollectionID uint      `gorm:"not null;column:collection_id" json:"collection_id"`
	FolderID     *uint     `gorm:"column:folder_id" json:"folder_id"`
	CreatedByID  *uint     `gorm:"column:created_by" json:"created_by"`
	OrderIndex         float64   `gorm:"default:0;column:order_index" json:"order_index"`
	PreRequestScript   string    `gorm:"type:text;column:pre_request_script" json:"pre_request_script"`
	PostRequestScript  string    `gorm:"type:text;column:post_request_script" json:"post_request_script"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`

	Collection *Collection      `gorm:"foreignKey:CollectionID" json:"-"`
	Folder     *Folder          `gorm:"foreignKey:FolderID" json:"-"`
	CreatedBy  *User            `gorm:"foreignKey:CreatedByID;references:ID" json:"-"`
	Examples   []RequestExample `gorm:"foreignKey:RequestID" json:"examples"`
}

type RequestExample struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	RequestID       uint      `gorm:"not null" json:"request_id"`
	Name            string    `gorm:"not null" json:"name"`
	RequestMethod   string    `gorm:"not null" json:"request_method"`
	RequestURL      string    `gorm:"not null" json:"request_url"`
	RequestHeaders  JSONB     `gorm:"type:jsonb;default:'{}'" json:"request_headers"`
	RequestBody     string    `gorm:"type:text" json:"request_body"`
	ResponseStatus  int       `gorm:"not null" json:"response_status"`
	ResponseHeaders JSONB     `gorm:"type:jsonb;default:'{}'" json:"response_headers"`
	ResponseBody    string    `gorm:"type:text" json:"response_body"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`

	Request *Request `gorm:"foreignKey:RequestID" json:"-"`
}

type Environment struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	Variables JSONB     `gorm:"type:jsonb;default:'{}'" json:"variables"`
	TeamID    uint      `gorm:"not null" json:"team_id"`
	CreatedAt time.Time `json:"created_at"`

	Team *Team `gorm:"foreignKey:TeamID" json:"-"`
}

type RequestHistory struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	UserID          uint      `gorm:"not null;column:user_id" json:"user_id"`
	TeamID          uint      `gorm:"index;not null" json:"team_id"`
	RequestID       uint      `gorm:"index;not null" json:"request_id"`
	Method          string    `gorm:"not null" json:"method"`
	URL             string    `gorm:"not null" json:"url"`
	RequestHeaders  JSONB     `gorm:"type:jsonb;default:'{}'" json:"request_headers"`
	RequestBody     string    `gorm:"type:text" json:"request_body"`
	ResponseHeaders JSONB     `gorm:"type:jsonb;default:'{}'" json:"response_headers"`
	ResponseBody    string    `gorm:"type:text" json:"response_body"`
	StatusCode      int       `json:"status_code"`
	ResponseTime    int       `json:"response_time"` // in ms
	CreatedAt       time.Time `json:"created_at"`

	User    *User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
	Team    *Team    `gorm:"foreignKey:TeamID" json:"-"`
	Request *Request `gorm:"foreignKey:RequestID" json:"-"`
}

type RequestVersion struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	RequestID         uint      `gorm:"not null" json:"request_id"`
	CreatedByID       uint      `gorm:"column:created_by;not null" json:"created_by"`
	Name              *string   `json:"name"`
	Method            string    `gorm:"not null" json:"method"`
	URL               string    `gorm:"not null" json:"url"`
	Headers           JSONB     `gorm:"type:jsonb;default:'{}'" json:"headers"`
	Body              JSONB     `gorm:"type:jsonb;default:'{}'" json:"body"`
	AuthConfig        JSONB     `gorm:"type:jsonb;default:'{}'" json:"auth_config"`
	PreRequestScript  string    `gorm:"type:text" json:"pre_request_script"`
	PostRequestScript string    `gorm:"type:text" json:"post_request_script"`
	CreatedAt         time.Time `json:"created_at"`

	Request   *Request `gorm:"foreignKey:RequestID" json:"-"`
	CreatedBy *User    `gorm:"foreignKey:CreatedByID;references:ID" json:"created_by_user,omitempty"`
}

type Comment struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	RequestID uint      `gorm:"not null" json:"request_id"`
	UserID    uint      `gorm:"not null" json:"user_id"`
	Content   string    `gorm:"not null" json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	Request *Request `gorm:"foreignKey:RequestID" json:"-"`
	User    *User    `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type ActivityLog struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	TeamID     uint      `gorm:"not null" json:"team_id"`
	UserID     uint      `gorm:"not null" json:"user_id"`
	Action     string    `gorm:"not null" json:"action"`
	EntityType string    `gorm:"not null" json:"entity_type"`
	EntityID   uint      `gorm:"not null" json:"entity_id"`
	Details    JSONB     `gorm:"type:jsonb;default:'{}'" json:"details"`
	CreatedAt  time.Time `json:"created_at"`

	Team *Team `gorm:"foreignKey:TeamID" json:"-"`
	User *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
}

type MockEndpoint struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	CollectionID     *uint     `gorm:"column:collection_id" json:"collection_id"`
	TeamID           *uint     `gorm:"column:team_id" json:"team_id"`
	RequestID        *uint     `gorm:"column:request_id" json:"request_id"`
	Method           string    `gorm:"not null" json:"method"`
	Path             string    `gorm:"not null" json:"path"`
	StatusCode       int       `gorm:"not null;default:200" json:"status_code"`
	ResponseHeaders  JSONB     `gorm:"type:jsonb;default:'{}'" json:"response_headers"`
	ResponseBody     string    `gorm:"type:text;default:''" json:"response_body"`
	DelayMs          int       `gorm:"default:0;column:delay_ms" json:"delay_ms"`
	IsActive         bool      `gorm:"default:false;column:is_active" json:"is_active"`
	EvaluationMode   string    `gorm:"not null;default:auto;column:evaluation_mode" json:"evaluation_mode"`
	ActiveScenarioID *uint     `gorm:"column:active_scenario_id" json:"active_scenario_id"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`

	Collection     *Collection    `gorm:"foreignKey:CollectionID" json:"-"`
	Team           *Team          `gorm:"foreignKey:TeamID" json:"-"`
	Request        *Request       `gorm:"foreignKey:RequestID" json:"-"`
	Scenarios      []MockScenario `gorm:"foreignKey:MockEndpointID" json:"scenarios,omitempty"`
	ActiveScenario *MockScenario  `gorm:"foreignKey:ActiveScenarioID" json:"active_scenario,omitempty"`
}

type MockScenario struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	MockEndpointID  uint           `gorm:"not null;column:mock_endpoint_id" json:"mock_endpoint_id"`
	Name            string         `gorm:"not null" json:"name"`
	StatusCode      int            `gorm:"not null;default:200" json:"status_code"`
	ResponseHeaders JSONB          `gorm:"type:jsonb;default:'{}'" json:"response_headers"`
	ResponseBody    string         `gorm:"type:text;default:''" json:"response_body"`
	Conditions      JSONBArray     `gorm:"type:jsonb;default:'[]'" json:"conditions"`
	ResponseType    string         `gorm:"not null;default:text;column:response_type" json:"response_type"`
	FileName        string         `gorm:"column:file_name" json:"file_name"`
	FileBase64      string         `gorm:"type:text;column:file_base64" json:"file_base64"`
	IsDefault       bool           `gorm:"default:false;column:is_default" json:"is_default"`
	OrderIndex      float64        `gorm:"not null;default:0;column:order_index" json:"order_index"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

type SystemSetting struct {
	Key       string    `gorm:"primaryKey" json:"key"`
	Value     string    `gorm:"not null" json:"value"`
	UpdatedAt time.Time `json:"updated_at"`
}

