package repository

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestJSONB_Value(t *testing.T) {
	t.Run("Valid Map", func(t *testing.T) {
		j := JSONB{"key": "value", "num": 123}
		val, err := j.Value()
		assert.NoError(t, err)
		assert.Contains(t, string(val.([]byte)), `"key":"value"`)
		assert.Contains(t, string(val.([]byte)), `"num":123`)
	})

	t.Run("Nil Map", func(t *testing.T) {
		var j JSONB
		val, err := j.Value()
		assert.NoError(t, err)
		assert.Equal(t, "null", string(val.([]byte)))
	})
}

func TestJSONB_Scan(t *testing.T) {
	t.Run("Valid JSON Bytes", func(t *testing.T) {
		var j JSONB
		input := []byte(`{"hello":"world"}`)
		err := j.Scan(input)
		assert.NoError(t, err)
		assert.Equal(t, "world", j["hello"])
	})

	t.Run("Nil Input", func(t *testing.T) {
		var j JSONB
		err := j.Scan(nil)
		assert.NoError(t, err)
		assert.NotNil(t, j)
		assert.Len(t, j, 0)
	})

	t.Run("Invalid Type", func(t *testing.T) {
		var j JSONB
		err := j.Scan(123)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "type assertion to []byte failed")
	})

	t.Run("Invalid JSON", func(t *testing.T) {
		var j JSONB
		err := j.Scan([]byte(`{invalid}`))
		assert.Error(t, err)
	})
}

func TestJSONBArray_Value(t *testing.T) {
	t.Run("Valid Array", func(t *testing.T) {
		j := JSONBArray{"a", 1, true}
		val, err := j.Value()
		assert.NoError(t, err)
		assert.Equal(t, `["a",1,true]`, string(val.([]byte)))
	})

	t.Run("Nil Array", func(t *testing.T) {
		var j JSONBArray
		val, err := j.Value()
		assert.NoError(t, err)
		assert.Equal(t, "null", string(val.([]byte)))
	})
}

func TestJSONBArray_Scan(t *testing.T) {
	t.Run("Valid JSON Bytes", func(t *testing.T) {
		var j JSONBArray
		input := []byte(`["one", "two"]`)
		err := j.Scan(input)
		assert.NoError(t, err)
		assert.Len(t, j, 2)
		assert.Equal(t, "one", j[0])
	})

	t.Run("Nil Input", func(t *testing.T) {
		var j JSONBArray
		err := j.Scan(nil)
		assert.NoError(t, err)
		assert.NotNil(t, j)
		assert.Len(t, j, 0)
	})

	t.Run("Invalid Type", func(t *testing.T) {
		var j JSONBArray
		err := j.Scan("not bytes")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "type assertion to []byte failed")
	})

	t.Run("Invalid JSON", func(t *testing.T) {
		var j JSONBArray
		err := j.Scan([]byte(`[unclosed`))
		assert.Error(t, err)
	})
}
