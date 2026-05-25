interface ParsedCurl {
  method: string
  url: string
  headers: Record<string, string>
  body: any
  bodyType: string
}

/**
 * Robust cURL Parser implemented in pure JavaScript (Tokenizer-based).
 * Handles multi-line commands, single/double quotes, and various body types.
 */
export const parseCurlCommand = async (curlCommand: string): Promise<ParsedCurl | null> => {
  try {
    // 1. Clean command from backslash multi-line (supporting space after backslash)
    const cleanCmd = curlCommand.replace(/\\\s*\n/g, ' ').replace(/\\\s*\r\n/g, ' ').trim()

    const result: ParsedCurl = {
      method: 'GET',
      url: '',
      headers: {},
      body: '',
      bodyType: 'none'
    }

    // 2. Tokenize the command respecting single and double quotes
    const tokens: string[] = []
    let currentToken = ''
    let inSingleQuote = false
    let inDoubleQuote = false

    for (let i = 0; i < cleanCmd.length; i++) {
      const char = cleanCmd[i]
      const prevChar = i > 0 ? cleanCmd[i - 1] : ''

      if (char === "'" && !inDoubleQuote && prevChar !== '\\') {
        inSingleQuote = !inSingleQuote
        continue
      }
      if (char === '"' && !inSingleQuote && prevChar !== '\\') {
        inDoubleQuote = !inDoubleQuote
        continue
      }

      const isWhitespace = /\s/.test(char)
      if (isWhitespace && !inSingleQuote && !inDoubleQuote) {
        if (currentToken.length > 0) {
          tokens.push(currentToken)
          currentToken = ''
        }
      } else {
        currentToken += char
      }
    }
    if (currentToken.length > 0) tokens.push(currentToken)

    // 3. Process tokens
    let hasBody = false
    let isUrlencoded = false

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i]
      
      if (token.toLowerCase() === 'curl') continue

      if (token === '-X' || token === '--request') {
        result.method = (tokens[i + 1] || 'GET').toUpperCase()
        i++
      } else if (token === '-H' || token === '--header') {
        const headerStr = tokens[i + 1] || ''
        const firstColon = headerStr.indexOf(':')
        if (firstColon > -1) {
          const key = headerStr.slice(0, firstColon).trim()
          const val = headerStr.slice(firstColon + 1).trim()
          result.headers[key] = val
        }
        i++
      } else if (token === '-d' || token === '--data' || token === '--data-raw' || token === '--data-binary' || token === '--data-urlencode') {
        if (token === '--data-urlencode') isUrlencoded = true
        hasBody = true
        const bodyPart = tokens[i + 1] || ''
        if (result.body && typeof result.body === 'string') {
          result.body += '&' + bodyPart
        } else {
          result.body = bodyPart
        }
        i++
      } else if (token === '-u' || token === '--user') {
        const authStr = tokens[i + 1] || ''
        try {
          const b64 = btoa(authStr)
          result.headers['Authorization'] = `Basic ${b64}`
        } catch (e) {
          console.error('Failed to encode basic auth', e)
        }
        i++
      } else if (token === '--url' || token === '--location') {
        // Skip --location, check if next token is URL
        if (tokens[i+1] && tokens[i+1].startsWith('http')) {
          result.url = tokens[i+1]
          i++
        }
      } else if (!token.startsWith('-')) {
        if (!result.url && token.startsWith('http')) {
          result.url = token
        }
      }
    }

    // 4. Post-process body and method
    if (hasBody) {
      if (result.method === 'GET') result.method = 'POST'
      
      const contentTypeKey = Object.keys(result.headers).find(k => k.toLowerCase() === 'content-type')
      const ctValue = contentTypeKey ? result.headers[contentTypeKey].toLowerCase() : ''

      if (isUrlencoded || ctValue.includes('application/x-www-form-urlencoded')) {
        result.bodyType = 'x-www-form-urlencoded'
        const parsedBody: any[] = []
        const parts = String(result.body).split('&')
        for (const part of parts) {
          const eqIdx = part.indexOf('=')
          if (eqIdx > -1) {
            try {
              parsedBody.push({
                key: decodeURIComponent(part.slice(0, eqIdx)),
                value: decodeURIComponent(part.slice(eqIdx + 1)),
                enabled: true,
                type: 'text'
              })
            } catch {
              parsedBody.push({ key: part.slice(0, eqIdx), value: part.slice(eqIdx + 1), enabled: true, type: 'text' })
            }
          } else if (part) {
            try {
              parsedBody.push({ key: '', value: decodeURIComponent(part), enabled: true, type: 'text' })
            } catch {
              parsedBody.push({ key: '', value: part, enabled: true, type: 'text' })
            }
          }
        }
        result.body = parsedBody
      } else if (ctValue.includes('multipart/form-data')) {
        result.bodyType = 'form-data'
        result.body = [] 
      } else {
        result.bodyType = 'raw-json'
        try {
          result.body = JSON.stringify(JSON.parse(result.body), null, 2)
        } catch (e) {
          result.bodyType = 'raw-text'
        }
      }
    }

    if (!result.url) return null
    return result

  } catch (error) {
    console.error('Critical failure in cURL parser:', error)
    return null
  }
}

interface GenerateCurlOptions {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string | any[]
  bodyType?: string
}

export const generateCurl = (opts: GenerateCurlOptions): string => {
  const { method, url, headers = {}, body, bodyType } = opts
  if (!url) return ''

  const parts: string[] = ['curl']

  if (method && method.toUpperCase() !== 'GET') {
    parts.push(`-X ${method.toUpperCase()}`)
  }

  parts.push(`'${url.replace(/'/g, "'\\''")}'`)

  Object.entries(headers).forEach(([key, value]) => {
    parts.push(`-H '${key}: ${String(value).replace(/'/g, "'\\''")}'`)
  })

  if (body && bodyType && bodyType !== 'none') {
    if (bodyType === 'x-www-form-urlencoded' && Array.isArray(body)) {
      const encoded = body
        .filter((r) => r.enabled && r.key)
        .map((r) => `${encodeURIComponent(r.key)}=${encodeURIComponent(r.value)}`)
        .join('&')
      parts.push(`--data-urlencode '${encoded}'`)
    } else if (bodyType === 'form-data' && Array.isArray(body)) {
      body
        .filter((r) => r.enabled && r.key)
        .forEach((r) => parts.push(`-F '${r.key}=${String(r.value).replace(/'/g, "'\\''")}'`))
    } else if (typeof body === 'string' && body.trim()) {
      parts.push(`--data-raw '${body.replace(/'/g, "'\\''")}'`)
    }
  }

  return parts.join(' \\\n  ')
}
