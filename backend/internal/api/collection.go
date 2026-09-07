package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/waluyo/wapbolt-backend/internal/middleware"
	"github.com/waluyo/wapbolt-backend/internal/repository"
	"gorm.io/gorm"
)

type CreateCollectionRequest struct {
	Name              string           `json:"name"`
	Description       string           `json:"description"`
	ConfluencePageID  string           `json:"confluence_page_id"`
	AuthConfig        repository.JSONB `json:"auth_config"`
	PreRequestScript  string           `json:"pre_request_script"`
	PostRequestScript string           `json:"post_request_script"`
	Variables         repository.JSONB `json:"variables"`
}

// Postman Collection Structs (simplified v2.1)
type PostmanCollection struct {
	Info struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	} `json:"info"`
	Item     []PostmanItem     `json:"item"`
	Auth     *PostmanAuth      `json:"auth,omitempty"`     // collection-level Authorization
	Variable []PostmanVariable `json:"variable,omitempty"` // collection-level Variables
	Event    []PostmanEvent    `json:"event,omitempty"`    // collection-level pre-request/test scripts
}

type PostmanItem struct {
	Name      string            `json:"name"`
	Item      []PostmanItem     `json:"item,omitempty"` // for folders
	Request   *PostmanReq       `json:"request,omitempty"`
	Responses []PostmanResponse `json:"response,omitempty"` // examples are at item level in Postman v2.1
	Event     []PostmanEvent    `json:"event,omitempty"`    // request-level pre-request/test scripts (item-level, sibling of request)
}

type PostmanReq struct {
	Method string      `json:"method"`
	URL    interface{} `json:"url"` // can be string or object
	Header []struct {
		Key      string `json:"key"`
		Value    string `json:"value"`
		Disabled bool   `json:"disabled"`
	} `json:"header"`
	Body             *PostmanBody           `json:"body"`
	Description      string                 `json:"description,omitempty"`
	FieldValidations map[string]interface{} `json:"field_validations,omitempty"`
	AuthConfig       map[string]interface{} `json:"auth_config,omitempty"` // Wapbolt's own export round-trip extension
	Auth             *PostmanAuth           `json:"auth,omitempty"`        // native Postman request-level Authorization
}

// PostmanAuth mirrors Postman v2.1's request.auth / collection.auth object.
// Only bearer/basic/apikey/noauth have a Wapbolt auth_config equivalent —
// other types (oauth2, digest, awsv4, hawk, ntlm, oauth1, ...) have no
// executable equivalent and are reported back as "unsupported" so the
// caller doesn't lose them silently.
type PostmanAuth struct {
	Type   string             `json:"type"`
	Bearer []PostmanAuthParam `json:"bearer,omitempty"`
	Basic  []PostmanAuthParam `json:"basic,omitempty"`
	Apikey []PostmanAuthParam `json:"apikey,omitempty"`
}

type PostmanAuthParam struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
	Type  string      `json:"type"`
}

// PostmanVariable mirrors an entry of Postman's collection-level `variable` array.
type PostmanVariable struct {
	Key   string      `json:"key"`
	Value interface{} `json:"value"`
}

// PostmanEvent mirrors Postman's `event` array (collection- and item-level
// pre-request/test scripts).
type PostmanEvent struct {
	Listen string `json:"listen"`
	Script struct {
		Exec []string `json:"exec"`
	} `json:"script"`
}

func postmanAuthParamsToMap(params []PostmanAuthParam) map[string]string {
	m := map[string]string{}
	for _, p := range params {
		if s, ok := p.Value.(string); ok {
			m[p.Key] = s
		}
	}
	return m
}

// resolvePostmanAuth converts Postman's native `auth` block into Wapbolt's
// auth_config shape for the types Wapbolt can actually execute. `nil` auth
// means "no Authorization tab data at all" (supported=true, config=nil —
// caller keeps whatever default applies). A recognized-but-unsupported type
// (oauth2, digest, awsv4, hawk, ntlm, oauth1, ...) returns supported=false so
// the caller can surface a summary instead of silently dropping it.
func resolvePostmanAuth(auth *PostmanAuth) (map[string]interface{}, bool) {
	if auth == nil {
		return nil, true
	}
	switch auth.Type {
	case "noauth":
		return map[string]interface{}{"type": "No Auth"}, true
	case "bearer":
		m := postmanAuthParamsToMap(auth.Bearer)
		return map[string]interface{}{"type": "Bearer Token", "token": m["token"]}, true
	case "basic":
		m := postmanAuthParamsToMap(auth.Basic)
		return map[string]interface{}{"type": "Basic Auth", "username": m["username"], "password": m["password"]}, true
	case "apikey":
		m := postmanAuthParamsToMap(auth.Apikey)
		addTo := "header"
		if m["in"] == "query" {
			addTo = "query"
		}
		return map[string]interface{}{"type": "API Key", "key": m["key"], "value": m["value"], "addTo": addTo}, true
	default:
		return nil, false
	}
}

// resolvePostmanScripts joins a Postman event array's prerequest/test exec
// lines into the single-string scripts Wapbolt stores.
func resolvePostmanScripts(events []PostmanEvent) (preRequest string, test string) {
	for _, e := range events {
		joined := strings.Join(e.Script.Exec, "\n")
		switch e.Listen {
		case "prerequest":
			preRequest = joined
		case "test":
			test = joined
		}
	}
	return
}

// PostmanBody mirrors Postman v2.1's request.body object across the modes we support.
type PostmanBody struct {
	Mode       string             `json:"mode"`
	Raw        string             `json:"raw"`
	URLEncoded []PostmanFormParam `json:"urlencoded"`
	FormData   []PostmanFormParam `json:"formdata"`
}

// PostmanFormParam mirrors an entry of Postman's body.urlencoded / body.formdata arrays.
type PostmanFormParam struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Type     string `json:"type"`
	Disabled bool   `json:"disabled"`
}

// postmanParamsToFields converts Postman form params into the {key,value,enabled,type}
// row shape KeyValueEditor expects for form-data / x-www-form-urlencoded bodies.
func postmanParamsToFields(params []PostmanFormParam) []map[string]interface{} {
	fields := make([]map[string]interface{}, 0, len(params))
	for _, p := range params {
		fieldType := "text"
		if p.Type == "file" {
			fieldType = "file"
		}
		fields = append(fields, map[string]interface{}{
			"key":     p.Key,
			"value":   p.Value,
			"enabled": !p.Disabled,
			"type":    fieldType,
		})
	}
	return fields
}

// resolvePostmanBody turns a Postman body block into the (body, body_type) pair
// stored on repository.Request, covering the modes actually used by exports:
// raw (json/xml/html/text), urlencoded, and formdata.
func resolvePostmanBody(b *PostmanBody) (map[string]interface{}, string) {
	if b == nil {
		return nil, "raw-json"
	}
	switch b.Mode {
	case "raw":
		var body map[string]interface{}
		json.Unmarshal([]byte(b.Raw), &body)
		return body, "raw-json"
	case "urlencoded":
		return map[string]interface{}{"array": postmanParamsToFields(b.URLEncoded)}, "x-www-form-urlencoded"
	case "formdata":
		return map[string]interface{}{"array": postmanParamsToFields(b.FormData)}, "form-data"
	default:
		return nil, "raw-json"
	}
}

type PostmanResponse struct {
	Name   string `json:"name"`
	Status string `json:"status"`
	Code   int    `json:"code"`
	Header []struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	} `json:"header"`
	Body string `json:"body"`
}

func SetupCollectionRoutes(app *fiber.App) {
	// Team-scoped collections
	app.Get("/api/v1/teams/:id/collections", middleware.RequireAuth, ListCollections)
	app.Post("/api/v1/teams/:id/collections", middleware.RequireAuth, CreateCollection)
	app.Post("/api/v1/teams/:id/import", middleware.RequireAuth, ImportPostman)
	app.Post("/api/v1/teams/:id/import-openapi", middleware.RequireAuth, ImportOpenAPI)

	// Collection CRUD
	app.Get("/api/v1/collections/:id", middleware.RequireAuth, GetCollection)
	app.Put("/api/v1/collections/:id", middleware.RequireAuth, UpdateCollection)
	app.Delete("/api/v1/collections/:id", middleware.RequireAuth, DeleteCollection)
	app.Post("/api/v1/collections/:id/duplicate", middleware.RequireAuth, DuplicateCollection)
}

// ─── OpenAPI / Swagger Import ────────────────────────────────────────────────

type OpenAPIInfo struct {
	Title       string `json:"title"`
	Description string `json:"description"`
	Version     string `json:"version"`
}

type OpenAPIServer struct {
	URL string `json:"url"`
}

type OpenAPITag struct {
	Name string `json:"name"`
}

type OpenAPIParameter struct {
	Name     string `json:"name"`
	In       string `json:"in"` // "header", "query", "path"
	Required bool   `json:"required"`
	Example  string `json:"example"`
	Schema   *struct {
		Type    string `json:"type"`
		Example string `json:"example"`
	} `json:"schema"`
}

type OpenAPIMediaType struct {
	Schema *struct {
		Type       string                 `json:"type"`
		Properties map[string]interface{} `json:"properties"`
		Example    interface{}            `json:"example"`
	} `json:"schema"`
	Example interface{} `json:"example"`
}

type OpenAPIRequestBody struct {
	Content map[string]OpenAPIMediaType `json:"content"`
}

type OpenAPIOperation struct {
	OperationID string                `json:"operationId"`
	Summary     string                `json:"summary"`
	Description string                `json:"description"`
	Tags        []string              `json:"tags"`
	Parameters  []OpenAPIParameter    `json:"parameters"`
	RequestBody *OpenAPIRequestBody   `json:"requestBody"`
	Security    []map[string][]string `json:"security"`
}

type OpenAPIPathItem struct {
	Get     *OpenAPIOperation `json:"get"`
	Post    *OpenAPIOperation `json:"post"`
	Put     *OpenAPIOperation `json:"put"`
	Patch   *OpenAPIOperation `json:"patch"`
	Delete  *OpenAPIOperation `json:"delete"`
	Head    *OpenAPIOperation `json:"head"`
	Options *OpenAPIOperation `json:"options"`
}

// Swagger 2.0 support
type SwaggerSpec struct {
	Swagger  string                     `json:"swagger"`
	Info     OpenAPIInfo                `json:"info"`
	Host     string                     `json:"host"`
	BasePath string                     `json:"basePath"`
	Schemes  []string                   `json:"schemes"`
	Paths    map[string]OpenAPIPathItem `json:"paths"`
	Tags     []OpenAPITag               `json:"tags"`
}

type OpenAPISecurityScheme struct {
	Type   string `json:"type"`   // "http", "apiKey", "oauth2", "openIdConnect"
	Scheme string `json:"scheme"` // "bearer", "basic"
	In     string `json:"in"`     // "header", "query", "cookie" (for apiKey)
	Name   string `json:"name"`   // header/query param name (for apiKey)
}

type OpenAPIComponents struct {
	SecuritySchemes map[string]OpenAPISecurityScheme `json:"securitySchemes"`
}

type OpenAPISpec struct {
	OpenAPI    string                     `json:"openapi"`
	Swagger    string                     `json:"swagger"`
	Info       OpenAPIInfo                `json:"info"`
	Servers    []OpenAPIServer            `json:"servers"`
	Paths      map[string]OpenAPIPathItem `json:"paths"`
	Tags       []OpenAPITag               `json:"tags"`
	Security   []map[string][]string      `json:"security"`
	Components OpenAPIComponents          `json:"components"`
}

// resolveOpenAPIAuth maps an OpenAPI security scheme to Wapbolt auth_config format.
func resolveOpenAPIAuth(schemes map[string]OpenAPISecurityScheme, security []map[string][]string) map[string]interface{} {
	if len(security) == 0 || len(schemes) == 0 {
		return nil
	}
	for _, req := range security {
		for schemeName := range req {
			scheme, ok := schemes[schemeName]
			if !ok {
				continue
			}
			switch strings.ToLower(scheme.Type) {
			case "http":
				switch strings.ToLower(scheme.Scheme) {
				case "bearer":
					return map[string]interface{}{"type": "Bearer Token", "token": ""}
				case "basic":
					return map[string]interface{}{"type": "Basic Auth", "username": "", "password": ""}
				}
			case "apikey":
				in := scheme.In
				if in == "" {
					in = "header"
				}
				return map[string]interface{}{"type": "API Key", "key": scheme.Name, "value": "", "in": in}
			case "oauth2":
				return map[string]interface{}{"type": "Bearer Token", "token": ""}
			}
		}
	}
	return nil
}

func ImportOpenAPI(c *fiber.Ctx) error {
	teamID := c.Params("id")
	if !isEditorOrAbove(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	mode := c.Query("mode", "new")
	confirmName := c.Query("confirm_name", "")
	rawUID, ok := c.Locals("user_id").(float64)
	if !ok || rawUID <= 0 {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	userID := uint(rawUID)
	tid := parseUint(teamID)

	// Parse raw body to detect version
	var raw map[string]interface{}
	if err := c.BodyParser(&raw); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON", "code": "BAD_REQUEST"})
	}

	// Re-encode to parse into typed struct
	rawBytes, err := json.Marshal(raw)
	if err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Failed to process request body", "code": "BAD_REQUEST"})
	}

	var spec OpenAPISpec
	if err := json.Unmarshal(rawBytes, &spec); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid OpenAPI JSON", "code": "BAD_REQUEST"})
	}

	// Detect Swagger 2.0 and handle host/basePath
	baseURL := ""
	isSwagger2 := spec.Swagger != "" && strings.HasPrefix(spec.Swagger, "2")
	if isSwagger2 {
		var sw SwaggerSpec
		json.Unmarshal(rawBytes, &sw)
		scheme := "https"
		if len(sw.Schemes) > 0 {
			scheme = sw.Schemes[0]
		}
		host := sw.Host
		if host == "" {
			host = "localhost"
		}
		baseURL = scheme + "://" + host + sw.BasePath
	} else if len(spec.Servers) > 0 {
		baseURL = strings.TrimRight(spec.Servers[0].URL, "/")
	}

	collectionName := spec.Info.Title
	if collectionName == "" {
		collectionName = "Imported API"
	}

	// Build tag → folder name map; requests without tags go to root
	type parsedRequest struct {
		tag  string
		item PostmanItem
	}
	var parsedRequests []parsedRequest

	methods := []struct {
		name string
		op   func(pi OpenAPIPathItem) *OpenAPIOperation
	}{
		{"GET", func(pi OpenAPIPathItem) *OpenAPIOperation { return pi.Get }},
		{"POST", func(pi OpenAPIPathItem) *OpenAPIOperation { return pi.Post }},
		{"PUT", func(pi OpenAPIPathItem) *OpenAPIOperation { return pi.Put }},
		{"PATCH", func(pi OpenAPIPathItem) *OpenAPIOperation { return pi.Patch }},
		{"DELETE", func(pi OpenAPIPathItem) *OpenAPIOperation { return pi.Delete }},
		{"HEAD", func(pi OpenAPIPathItem) *OpenAPIOperation { return pi.Head }},
		{"OPTIONS", func(pi OpenAPIPathItem) *OpenAPIOperation { return pi.Options }},
	}

	for path, pathItem := range spec.Paths {
		for _, m := range methods {
			op := m.op(pathItem)
			if op == nil {
				continue
			}

			fullURL := baseURL + path
			name := op.Summary
			if name == "" {
				name = op.OperationID
			}
			if name == "" {
				name = m.name + " " + path
			}

			// Build headers from parameters where in=header
			headers := []struct {
				Key      string `json:"key"`
				Value    string `json:"value"`
				Disabled bool   `json:"disabled"`
			}{}
			for _, p := range op.Parameters {
				if p.In == "header" {
					val := p.Example
					if val == "" && p.Schema != nil {
						val = p.Schema.Example
					}
					headers = append(headers, struct {
						Key      string `json:"key"`
						Value    string `json:"value"`
						Disabled bool   `json:"disabled"`
					}{Key: p.Name, Value: val})
				}
			}

			// Build body from requestBody
			var body *PostmanBody
			if op.RequestBody != nil {
				if mt, ok := op.RequestBody.Content["application/json"]; ok {
					var example interface{}
					if mt.Example != nil {
						example = mt.Example
					} else if mt.Schema != nil && mt.Schema.Example != nil {
						example = mt.Schema.Example
					} else if mt.Schema != nil && mt.Schema.Properties != nil {
						example = mt.Schema.Properties
					}
					if example != nil {
						b, _ := json.MarshalIndent(example, "", "  ")
						body = &PostmanBody{Mode: "raw", Raw: string(b)}
					}
				}
			}

			tag := ""
			if len(op.Tags) > 0 {
				tag = op.Tags[0]
			}

			// Resolve auth: prefer operation-level security, fall back to global
			opSecurity := op.Security
			if opSecurity == nil {
				opSecurity = spec.Security
			}
			authConfig := resolveOpenAPIAuth(spec.Components.SecuritySchemes, opSecurity)

			item := PostmanItem{
				Name: name,
				Request: &PostmanReq{
					Method:      m.name,
					URL:         fullURL,
					Header:      headers,
					Body:        body,
					Description: op.Description,
					AuthConfig:  authConfig,
				},
			}
			parsedRequests = append(parsedRequests, parsedRequest{tag: tag, item: item})
		}
	}

	// Group into folders by tag
	tagOrder := []string{}
	tagMap := map[string][]PostmanItem{}
	for _, pr := range parsedRequests {
		if _, exists := tagMap[pr.tag]; !exists {
			tagOrder = append(tagOrder, pr.tag)
		}
		tagMap[pr.tag] = append(tagMap[pr.tag], pr.item)
	}

	// Build PostmanCollection structure
	var topItems []PostmanItem
	for _, tag := range tagOrder {
		items := tagMap[tag]
		if tag == "" {
			topItems = append(topItems, items...)
		} else {
			topItems = append(topItems, PostmanItem{Name: tag, Item: items})
		}
	}

	postman := PostmanCollection{
		Info: struct {
			Name        string `json:"name"`
			Description string `json:"description"`
		}{Name: collectionName, Description: spec.Info.Description},
		Item: topItems,
	}

	var collection repository.Collection

	err = repository.DB.Transaction(func(tx *gorm.DB) error {
		if mode == "overwrite" {
			err := tx.Where("team_id = ? AND name = ?", tid, collectionName).First(&collection).Error
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return fmt.Errorf("collection '%s' not found for overwrite", collectionName)
				}
				return err
			}
			if confirmName != collection.Name {
				return fmt.Errorf("confirmation name mismatch: expected '%s', got '%s'", collection.Name, confirmName)
			}
			if err := tx.Where("collection_id = ?", collection.ID).Delete(&repository.Folder{}).Error; err != nil {
				return err
			}
			if err := tx.Where("collection_id = ?", collection.ID).Delete(&repository.Request{}).Error; err != nil {
				return err
			}
			collection.Description = spec.Info.Description
			if err := tx.Save(&collection).Error; err != nil {
				return err
			}
		} else {
			collection = repository.Collection{
				Name:        collectionName,
				Description: spec.Info.Description,
				TeamID:      tid,
				CreatedByID: &userID,
			}
			if err := tx.Create(&collection).Error; err != nil {
				return err
			}
		}
		unusedAuthCount := 0
		return processPostmanItems(tx, postman.Item, collection.ID, nil, userID, &unusedAuthCount)
	})

	if err != nil {
		code := "INTERNAL_SERVER_ERROR"
		status := fiber.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "mismatch") {
			code = "BAD_REQUEST"
			status = fiber.StatusBadRequest
		}
		return c.Status(status).JSON(fiber.Map{"error": err.Error(), "code": code})
	}

	WSHub.BroadcastEntityUpdate(tid, "TEAM", tid)
	action := "IMPORTED_OPENAPI_COLLECTION"
	if mode == "overwrite" {
		action = "UPDATED_COLLECTION_VIA_OPENAPI_IMPORT"
	}
	LogActivity(repository.DB, tid, userID, action, "TEAM", tid, map[string]interface{}{"collection_name": collectionName})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":       "OpenAPI import successful",
		"collection_id": collection.ID,
		"request_count": len(parsedRequests),
	})
}

func ImportPostman(c *fiber.Ctx) error {
	teamID := c.Params("id")
	if !isEditorOrAbove(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var postman PostmanCollection
	if err := c.BodyParser(&postman); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid Postman JSON", "code": "BAD_REQUEST"})
	}

	// Import Options from Query Params
	mode := c.Query("mode", "new") // default to 'new' for safety
	confirmName := c.Query("confirm_name", "")

	rawUID, ok := c.Locals("user_id").(float64)
	if !ok || rawUID <= 0 {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	userID := uint(rawUID)
	tid := parseUint(teamID)

	var collection repository.Collection
	unsupportedAuthCount := 0

	collAuth, collAuthOk := resolvePostmanAuth(postman.Auth)
	if !collAuthOk {
		unsupportedAuthCount++
	}
	collVars := repository.JSONB{}
	for _, v := range postman.Variable {
		if s, ok := v.Value.(string); ok {
			collVars[v.Key] = s
		} else if v.Value != nil {
			collVars[v.Key] = fmt.Sprintf("%v", v.Value)
		}
	}
	collPreScript, collTestScript := resolvePostmanScripts(postman.Event)

	err := repository.DB.Transaction(func(tx *gorm.DB) error {
		if mode == "overwrite" {
			// 1. Search for collection to overwrite
			err := tx.Where("team_id = ? AND name = ?", tid, postman.Info.Name).First(&collection).Error
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return fmt.Errorf("collection '%s' not found for overwrite", postman.Info.Name)
				}
				return err
			}

			// 2. Safety Check: Verify confirmation name matches
			if confirmName != collection.Name {
				return fmt.Errorf("confirmation name mismatch: expected '%s', got '%s'", collection.Name, confirmName)
			}

			// 3. Clear existing contents
			if err := tx.Where("collection_id = ?", collection.ID).Delete(&repository.Folder{}).Error; err != nil {
				return err
			}
			if err := tx.Where("collection_id = ?", collection.ID).Delete(&repository.Request{}).Error; err != nil {
				return err
			}

			// Update description + Authorization/Scripts/Variables from the Postman file
			collection.Description = postman.Info.Description
			if collAuth != nil {
				collection.AuthConfig = repository.JSONB(collAuth)
			}
			collection.PreRequestScript = collPreScript
			collection.PostRequestScript = collTestScript
			collection.Variables = collVars
			if err := tx.Save(&collection).Error; err != nil {
				return err
			}
		} else {
			authConfig := repository.JSONB{"type": "No Auth"}
			if collAuth != nil {
				authConfig = repository.JSONB(collAuth)
			}
			// Create brand new collection (even if name matches, will be a duplicate)
			collection = repository.Collection{
				Name:              postman.Info.Name,
				Description:       postman.Info.Description,
				TeamID:            tid,
				CreatedByID:       &userID,
				AuthConfig:        authConfig,
				PreRequestScript:  collPreScript,
				PostRequestScript: collTestScript,
				Variables:         collVars,
			}
			if err := tx.Create(&collection).Error; err != nil {
				return err
			}
		}

		// 2. Process Items recursively
		return processPostmanItems(tx, postman.Item, collection.ID, nil, userID, &unsupportedAuthCount)
	})

	if err != nil {
		code := "INTERNAL_SERVER_ERROR"
		status := fiber.StatusInternalServerError
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "mismatch") {
			code = "BAD_REQUEST"
			status = fiber.StatusBadRequest
		}
		return c.Status(status).JSON(fiber.Map{"error": err.Error(), "code": code})
	}

	// Real-time broadcast
	WSHub.BroadcastEntityUpdate(tid, "TEAM", tid)
	action := "IMPORTED_COLLECTION"
	if mode == "overwrite" {
		action = "UPDATED_COLLECTION_VIA_IMPORT"
	}
	LogActivity(repository.DB, tid, userID, action, "TEAM", tid, map[string]interface{}{"collection_name": postman.Info.Name})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"message":                "Import successful",
		"collection_id":          collection.ID,
		"unsupported_auth_count": unsupportedAuthCount,
	})
}

func processPostmanItems(tx *gorm.DB, items []PostmanItem, collectionID uint, folderID *uint, userID uint, unsupportedAuthCount *int) error {
	for _, item := range items {
		if item.Item != nil {
			// It's a folder
			folder := repository.Folder{
				Name:           item.Name,
				CollectionID:   collectionID,
				ParentFolderID: folderID,
			}
			if err := tx.Create(&folder).Error; err != nil {
				return err
			}
			if err := processPostmanItems(tx, item.Item, collectionID, &folder.ID, userID, unsupportedAuthCount); err != nil {
				return err
			}
		} else if item.Request != nil {
			// It's a request
			headers := repository.JSONB{}
			for _, h := range item.Request.Header {
				if h.Disabled {
					continue
				}
				headers[h.Key] = h.Value
			}

			body, bodyType := resolvePostmanBody(item.Request.Body)

			// Handle URL (can be string or object)
			urlStr := ""
			switch v := item.Request.URL.(type) {
			case string:
				urlStr = v
			case map[string]interface{}:
				if raw, ok := v["raw"].(string); ok {
					urlStr = raw
				}
			}

			reqAuth, reqAuthOk := resolvePostmanAuth(item.Request.Auth)
			if !reqAuthOk {
				*unsupportedAuthCount++
			}
			authConfig := repository.JSONB{"type": "No Auth"}
			if reqAuth != nil {
				authConfig = repository.JSONB(reqAuth)
			} else if item.Request.AuthConfig != nil {
				// Wapbolt's own export round-trip extension (not a native Postman field)
				authConfig = repository.JSONB(item.Request.AuthConfig)
			}
			preScript, testScript := resolvePostmanScripts(item.Event)
			request := repository.Request{
				Name:              item.Name,
				CollectionID:      collectionID,
				FolderID:          folderID,
				Method:            item.Request.Method,
				URL:               urlStr,
				Headers:           headers,
				Body:              body,
				BodyType:          bodyType,
				Description:       item.Request.Description,
				FieldValidations:  item.Request.FieldValidations,
				CreatedByID:       &userID,
				AuthConfig:        authConfig,
				PreRequestScript:  preScript,
				PostRequestScript: testScript,
			}
			if err := tx.Create(&request).Error; err != nil {
				return err
			}

			// 3. Process Examples (Responses) - responses are at item level in Postman v2.1
			var requestBodyJSONB repository.JSONBAny
			if item.Request.Body != nil && item.Request.Body.Raw != "" {
				requestBodyJSONB, _ = json.Marshal(map[string]interface{}{"raw": item.Request.Body.Raw})
			}
			for _, res := range item.Responses {
				resHeaders := repository.JSONB{}
				for _, rh := range res.Header {
					resHeaders[rh.Key] = rh.Value
				}

				example := repository.RequestExample{
					RequestID:       request.ID,
					Name:            res.Name,
					RequestMethod:   item.Request.Method,
					RequestURL:      urlStr,
					RequestHeaders:  headers,
					RequestBody:     requestBodyJSONB,
					ResponseStatus:  res.Code,
					ResponseHeaders: resHeaders,
					ResponseBody:    res.Body,
				}
				if err := tx.Create(&example).Error; err != nil {
					return err
				}
			}
		}
	}
	return nil
}

func ListCollections(c *fiber.Ctx) error {
	teamID := c.Params("id")

	if !canAccessTeam(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var collections []repository.Collection
	if err := repository.DB.Where("team_id = ?", teamID).Find(&collections).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to fetch collections", "code": "INTERNAL_SERVER_ERROR"})
	}

	return c.JSON(collections)
}

func CreateCollection(c *fiber.Ctx) error {
	teamID := c.Params("id")

	if !isEditorOrAbove(c, parseUint(teamID)) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var req CreateCollectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}
	if req.AuthConfig == nil {
		req.AuthConfig = repository.JSONB{}
	}
	if req.Variables == nil {
		req.Variables = repository.JSONB{}
	}

	rawUID, ok := c.Locals("user_id").(float64)
	if !ok || rawUID <= 0 {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	userID := uint(rawUID)
	tid := parseUint(teamID)

	collection := repository.Collection{
		Name:              req.Name,
		Description:       req.Description,
		TeamID:            tid,
		CreatedByID:       &userID,
		ConfluencePageID:  req.ConfluencePageID,
		AuthConfig:        req.AuthConfig,
		PreRequestScript:  req.PreRequestScript,
		PostRequestScript: req.PostRequestScript,
		Variables:         req.Variables,
	}

	if err := repository.DB.Create(&collection).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to create collection", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	WSHub.BroadcastEntityUpdate(tid, "TEAM", tid)
	LogActivity(repository.DB, tid, userID, "CREATED_COLLECTION", "COLLECTION", collection.ID, map[string]interface{}{"name": collection.Name})
	NotifyEntityUpdate(tid, userID, "Collection", collection.Name, "create", map[string]interface{}{"collection_id": collection.ID})

	return c.Status(fiber.StatusCreated).JSON(collection)
}

func GetCollection(c *fiber.Ctx) error {
	collectionID := c.Params("id")

	var collection repository.Collection
	if err := repository.DB.First(&collection, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}

	if !canAccessTeam(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	// Include folders and root requests
	var folders []repository.Folder
	var requests []repository.Request
	repository.DB.Where("collection_id = ? AND parent_folder_id IS NULL", collection.ID).Find(&folders)
	repository.DB.Where("collection_id = ? AND folder_id IS NULL", collection.ID).Find(&requests)

	return c.JSON(fiber.Map{
		"collection": collection,
		"folders":    folders,
		"requests":   requests,
	})
}

func UpdateCollection(c *fiber.Ctx) error {
	collectionID := c.Params("id")

	var collection repository.Collection
	if err := repository.DB.First(&collection, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}

	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	var req CreateCollectionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid request body", "code": "BAD_REQUEST"})
	}
	if req.AuthConfig == nil {
		req.AuthConfig = repository.JSONB{}
	}
	if req.Variables == nil {
		req.Variables = repository.JSONB{}
	}

	if req.Name != "" {
		collection.Name = req.Name
	}
	if req.Description != "" {
		collection.Description = req.Description
	}
	// Always allow updating page id (even to empty string)
	collection.ConfluencePageID = req.ConfluencePageID
	// Always overwrite settings — the settings modal always submits full state.
	collection.AuthConfig = req.AuthConfig
	collection.PreRequestScript = req.PreRequestScript
	collection.PostRequestScript = req.PostRequestScript
	collection.Variables = req.Variables

	if err := repository.DB.Save(&collection).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to update collection", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	rawUID, ok := c.Locals("user_id").(float64)
	if !ok || rawUID <= 0 {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	userID := uint(rawUID)
	WSHub.BroadcastEntityUpdate(collection.TeamID, "TEAM", collection.TeamID)
	LogActivity(repository.DB, collection.TeamID, userID, "UPDATED_COLLECTION", "COLLECTION", collection.ID, nil)
	NotifyEntityUpdate(collection.TeamID, userID, "Collection", collection.Name, "update", map[string]interface{}{"collection_id": collection.ID})

	return c.JSON(collection)
}

func DeleteCollection(c *fiber.Ctx) error {
	collectionID := c.Params("id")

	var collection repository.Collection
	if err := repository.DB.First(&collection, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}

	if !isEditorOrAbove(c, collection.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	if err := repository.DB.Delete(&collection).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to delete collection", "code": "INTERNAL_SERVER_ERROR"})
	}

	// Real-time broadcast & logging
	rawUID, ok := c.Locals("user_id").(float64)
	if !ok || rawUID <= 0 {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	userID := uint(rawUID)
	WSHub.BroadcastEntityUpdate(collection.TeamID, "TEAM", collection.TeamID)
	LogActivity(repository.DB, collection.TeamID, userID, "DELETED_COLLECTION", "COLLECTION", collection.ID, map[string]interface{}{"name": collection.Name})
	NotifyEntityUpdate(collection.TeamID, userID, "Collection", collection.Name, "delete", map[string]interface{}{"collection_id": collection.ID})

	return c.JSON(fiber.Map{"message": "Collection deleted successfully"})
}

func DuplicateCollection(c *fiber.Ctx) error {
	collectionID := c.Params("id")

	var original repository.Collection
	if err := repository.DB.First(&original, collectionID).Error; err != nil {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found", "code": "NOT_FOUND"})
	}

	if !isEditorOrAbove(c, original.TeamID) {
		return c.Status(fiber.StatusForbidden).JSON(fiber.Map{"error": "Forbidden", "code": "FORBIDDEN"})
	}

	rawUID, ok := c.Locals("user_id").(float64)
	if !ok || rawUID <= 0 {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	userID := uint(rawUID)

	newCollection := repository.Collection{
		Name:              original.Name + " Copy",
		Description:       original.Description,
		TeamID:            original.TeamID,
		CreatedByID:       &userID,
		AuthConfig:        original.AuthConfig,
		PreRequestScript:  original.PreRequestScript,
		PostRequestScript: original.PostRequestScript,
		Variables:         original.Variables,
		ChaosMode:         original.ChaosMode,
	}
	if err := repository.DB.Create(&newCollection).Error; err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to duplicate collection", "code": "INTERNAL_SERVER_ERROR"})
	}

	var rootRequests []repository.Request
	repository.DB.Where("collection_id = ? AND folder_id IS NULL", original.ID).Find(&rootRequests)
	for _, r := range rootRequests {
		newRequest := repository.Request{
			Name:              r.Name,
			Description:       r.Description,
			Method:            r.Method,
			URL:               r.URL,
			Headers:           r.Headers,
			Body:              r.Body,
			BodyType:          r.BodyType,
			BodyVariants:      r.BodyVariants,
			AuthConfig:        r.AuthConfig,
			FieldValidations:  r.FieldValidations,
			CollectionID:      newCollection.ID,
			FolderID:          nil,
			CreatedByID:       &userID,
			OrderIndex:        r.OrderIndex,
			PreRequestScript:  r.PreRequestScript,
			PostRequestScript: r.PostRequestScript,
		}
		repository.DB.Create(&newRequest)
	}

	var rootFolders []repository.Folder
	repository.DB.Where("collection_id = ? AND parent_folder_id IS NULL", original.ID).Find(&rootFolders)
	for _, f := range rootFolders {
		if _, err := duplicateFolderTree(f.ID, newCollection.ID, nil, "", userID); err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"error": "Failed to duplicate collection", "code": "INTERNAL_SERVER_ERROR"})
		}
	}

	WSHub.BroadcastEntityUpdate(original.TeamID, "TEAM", original.TeamID)
	LogActivity(repository.DB, original.TeamID, userID, "CREATED_COLLECTION", "COLLECTION", newCollection.ID, map[string]interface{}{"name": newCollection.Name})
	NotifyEntityUpdate(original.TeamID, userID, "Collection", newCollection.Name, "create", map[string]interface{}{"collection_id": newCollection.ID})

	return c.Status(fiber.StatusCreated).JSON(newCollection)
}
