import * as Dialog from '@radix-ui/react-dialog'
import { useState, useMemo } from 'react'
import { X, Code, Copy, Check, Terminal, Globe, Cpu } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { toast } from 'sonner'
import { useAppStore } from '../../store/useAppStore'

interface ExportCodeModalProps {
  isOpen: boolean
  onClose: () => void
  requestData: {
    method: string
    url: string
    headers: Record<string, string>
    body: any
    body_type: string
  }
}

type LanguageId = 
  | 'curl' | 'httpie' | 'wget'
  | 'js-fetch' | 'js-axios' | 'js-jquery'
  | 'node-native' | 'node-axios'
  | 'python-requests' | 'go-native' 
  | 'php-curl' | 'php-guzzle'
  | 'java-okhttp' | 'ruby-net-http'
  | 'csharp-restsharp'

interface LangOption {
  id: LanguageId
  label: string
  group: 'Shell' | 'JavaScript' | 'Backend'
  icon: any
}

const LANGUAGES: LangOption[] = [
  { id: 'curl', label: 'cURL', group: 'Shell', icon: Terminal },
  { id: 'httpie', label: 'HTTPie', group: 'Shell', icon: Terminal },
  { id: 'wget', label: 'Wget', group: 'Shell', icon: Terminal },
  { id: 'js-fetch', label: 'Fetch API', group: 'JavaScript', icon: Globe },
  { id: 'js-axios', label: 'Axios', group: 'JavaScript', icon: Globe },
  { id: 'js-jquery', label: 'jQuery AJAX', group: 'JavaScript', icon: Globe },
  { id: 'node-native', label: 'Node Native', group: 'Backend', icon: Cpu },
  { id: 'node-axios', label: 'Node Axios', group: 'Backend', icon: Cpu },
  { id: 'go-native', label: 'Go Native', group: 'Backend', icon: Cpu },
  { id: 'python-requests', label: 'Python Requests', group: 'Backend', icon: Cpu },
  { id: 'php-curl', label: 'PHP cURL', group: 'Backend', icon: Cpu },
  { id: 'php-guzzle', label: 'PHP Guzzle', group: 'Backend', icon: Cpu },
  { id: 'java-okhttp', label: 'Java OkHttp', group: 'Backend', icon: Cpu },
  { id: 'ruby-net-http', label: 'Ruby Net::HTTP', group: 'Backend', icon: Cpu },
  { id: 'csharp-restsharp', label: 'C# RestSharp', group: 'Backend', icon: Cpu },
]

export const ExportCodeModal = ({
  isOpen,
  onClose,
  requestData
}: ExportCodeModalProps): React.JSX.Element => {
  const { theme } = useAppStore()
  const monacoTheme = theme === 'system'
    ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'vs-dark' : 'vs')
    : (theme === 'dark' ? 'vs-dark' : 'vs')
    
  const [selectedLang, setSelectedLang] = useState<LanguageId>('curl')
  const [copied, setCopied] = useState(false)

  const codeSnippet = useMemo(() => {
    const { method, url, headers, body, body_type } = requestData
    const hasBody = body_type !== 'none' && body && (typeof body === 'string' ? body.length > 0 : Array.isArray(body) ? body.length > 0 : true)

    let bodyStr = ''
    if (hasBody) {
      if (body_type === 'x-www-form-urlencoded' && Array.isArray(body)) {
        const params = new URLSearchParams()
        body.forEach((item: any) => {
          if (item.enabled && item.key) params.append(item.key, item.value || '')
        })
        bodyStr = params.toString()
      } else if (body_type === 'form-data' && Array.isArray(body)) {
        // Simple string representation for cURL, etc.
        bodyStr = body
          .filter((item: any) => item.enabled && item.key)
          .map((item: any) => `${item.key}=${item.value || ''}`)
          .join('&')
      } else {
        bodyStr = typeof body === 'string' ? body : JSON.stringify(body, null, 2)
      }
    }

    switch (selectedLang) {
      case 'curl': {
        let s = `curl -X ${method} "${url}"`
        Object.entries(headers).forEach(([k, v]) => s += ` \\\n  -H "${k}: ${v}"`)
        if (hasBody) {
          if (body_type === 'x-www-form-urlencoded' && Array.isArray(body)) {
            const items = (body as any[]).filter(i => i.enabled && i.key)
            items.forEach(item => {
              s += ` \\\n  --data-urlencode '${item.key}=${(item.value || '').replace(/'/g, "'\\''")}'`
            })
          } else if (body_type === 'form-data' && Array.isArray(body)) {
            const items = (body as any[]).filter(i => i.enabled && i.key)
            items.forEach(item => {
              s += ` \\\n  -F "${item.key}=${item.value || ''}"`
            })
          } else {
            s += ` \\\n  -d '${bodyStr.replace(/'/g, "'\\''")}'`
          }
        }
        return s
      }
      case 'httpie': {
        let s = `http ${method} "${url}"`
        Object.entries(headers).forEach(([k, v]) => s += ` \\\n  "${k}:${v}"`)
        if (hasBody) {
          if ((body_type === 'x-www-form-urlencoded' || body_type === 'form-data') && Array.isArray(body)) {
            const items = (body as any[]).filter(i => i.enabled && i.key)
            items.forEach(item => {
              s += ` \\\n  ${item.key}='${item.value || ''}'`
            })
          } else {
            s += ` \\\n  rawBody='${bodyStr}'`
          }
        }
        return s
      }
      case 'wget': {
        return `wget --method=${method} \\\n  --header='Content-Type: ${headers['Content-Type'] || 'application/json'}' \\\n  --body-data='${bodyStr}' \\\n  '${url}'`
      }
      case 'js-fetch': {
        const formDataSetup = body_type === 'form-data' && Array.isArray(body)
          ? 'const formData = new FormData();\n' + (body as any[]).filter(i => i.enabled && i.key).map(i => `formData.append("${i.key}", "${i.value}");`).join('\n') + '\n\n'
          : ''
        let bodyCode = ''
        if (hasBody) {
          if (body_type === 'x-www-form-urlencoded' && Array.isArray(body)) {
            bodyCode = `,\n  body: new URLSearchParams(${JSON.stringify(Object.fromEntries((body as any[]).filter(i => i.enabled && i.key).map(i => [i.key, i.value || ''])))})`
          } else if (body_type === 'form-data' && Array.isArray(body)) {
            bodyCode = `,\n  body: formData`
          } else if (body_type.includes('json')) {
            bodyCode = `,\n  body: JSON.stringify(${bodyStr})`
          } else {
            bodyCode = `,\n  body: \`${bodyStr}\``
          }
        }
        return `${formDataSetup}fetch("${url}", {\n  method: "${method}",\n  headers: ${JSON.stringify(headers, null, 2)}${bodyCode}\n})\n  .then(res => res.json())\n  .then(console.log)\n  .catch(console.error);`
      }
      case 'js-axios': {
        let dataProp = ''
        if (hasBody) {
          if (body_type === 'x-www-form-urlencoded' && Array.isArray(body)) {
            dataProp = `,\n  data: new URLSearchParams(${JSON.stringify(Object.fromEntries((body as any[]).filter(i => i.enabled && i.key).map(i => [i.key, i.value || ''])))})`
          } else if (body_type === 'form-data' && Array.isArray(body)) {
            const formLines = (body as any[]).filter(i => i.enabled && i.key).map(i => `  formData.append("${i.key}", "${i.value || ''}");`).join('\n')
            return `import axios from 'axios';\n\nconst formData = new FormData();\n${formLines}\n\naxios({\n  method: '${method}',\n  url: '${url}',\n  headers: ${JSON.stringify(headers, null, 2)},\n  data: formData\n}).then(res => console.log(res.data));`
          } else if (body_type.includes('json')) {
            dataProp = `,\n  data: ${bodyStr}`
          } else {
            dataProp = `,\n  data: \`${bodyStr}\``
          }
        }
        return `import axios from 'axios';\n\naxios({\n  method: '${method}',\n  url: '${url}',\n  headers: ${JSON.stringify(headers, null, 2)}${dataProp}\n}).then(res => console.log(res.data));`
      }
      case 'js-jquery': {
        return `$.ajax({\n  url: "${url}",\n  method: "${method}",\n  headers: ${JSON.stringify(headers, null, 2)},\n  data: ${hasBody ? (body_type.includes('json') ? bodyStr : `\`${bodyStr}\``) : 'null'},\n  success: console.log,\n  error: console.error\n});`
      }
      case 'node-native': {
        try {
          const urlObj = new URL(url)
          const protocol = urlObj.protocol === 'https:' ? 'https' : 'http'
          const bodyWrite = hasBody
            ? `\nreq.write(${body_type.includes('json') ? `JSON.stringify(${bodyStr})` : `\`${bodyStr}\``});`
            : ''
          return `const ${protocol} = require("${protocol}");\n\nconst options = {\n  method: "${method}",\n  hostname: "${urlObj.hostname}",\n  port: ${urlObj.port || (protocol === 'https' ? 443 : 80)},\n  path: "${urlObj.pathname}${urlObj.search}",\n  headers: ${JSON.stringify(headers, null, 2)}\n};\n\nconst req = ${protocol}.request(options, (res) => {\n  let data = '';\n  res.on("data", (chunk) => data += chunk);\n  res.on("end", () => console.log(JSON.parse(data)));\n});${bodyWrite}\nreq.on("error", console.error);\nreq.end();`
        } catch {
          return `// Invalid URL: ${url}`
        }
      }
      case 'node-axios': {
        let dataProp = ''
        if (hasBody) {
          dataProp = body_type.includes('json') ? `,\n  data: ${bodyStr}` : `,\n  data: \`${bodyStr}\``
        }
        return `const axios = require('axios');\n\naxios({\n  method: '${method}',\n  url: '${url}',\n  headers: ${JSON.stringify(headers, null, 2)}${dataProp}\n})\n  .then(res => console.log(res.data))\n  .catch(console.error);`
      }
      case 'go-native': {
        const bodyArg = hasBody ? `strings.NewReader(\`${bodyStr}\`)` : 'nil'
        const imports = hasBody
          ? `"fmt"\n\t"io"\n\t"net/http"\n\t"strings"`
          : `"fmt"\n\t"io"\n\t"net/http"`
        return `package main\n\nimport (\n\t${imports}\n)\n\nfunc main() {\n\tclient := &http.Client{}\n\treq, _ := http.NewRequest("${method}", "${url}", ${bodyArg})\n\t${Object.entries(headers).map(([k, v]) => `req.Header.Add("${k}", "${v}")`).join('\n\t')}\n\tres, err := client.Do(req)\n\tif err != nil {\n\t\tpanic(err)\n\t}\n\tdefer res.Body.Close()\n\tbody, _ := io.ReadAll(res.Body)\n\tfmt.Println(string(body))\n}`
      }
      case 'python-requests': {
        const isJson = body_type.includes('json')
        const payloadLine = hasBody
          ? isJson
            ? `payload = ${bodyStr}`
            : `payload = """${bodyStr}"""`
          : `payload = None`
        return `import requests\nimport json\n\nurl = "${url}"\n${payloadLine}\nheaders = ${JSON.stringify(headers, null, 2)}\n\nresponse = requests.request(\n    "${method}",\n    url,\n    ${isJson ? 'json=payload,' : 'data=payload,'}\n    headers=headers\n)\nprint(response.status_code)\nprint(response.json())`
      }
      case 'php-curl': {
        const headerArr = Object.entries(headers).map(([k, v]) => `"${k}: ${v}"`).join(',\n    ')
        return `<?php\n$curl = curl_init();\n\ncurl_setopt_array($curl, [\n  CURLOPT_URL => "${url}",\n  CURLOPT_RETURNTRANSFER => true,\n  CURLOPT_CUSTOMREQUEST => "${method}",${hasBody ? `\n  CURLOPT_POSTFIELDS => '${bodyStr.replace(/'/g, "\\'")}',` : ''}\n  CURLOPT_HTTPHEADER => [\n    ${headerArr}\n  ],\n]);\n\n$response = curl_exec($curl);\n$err = curl_error($curl);\ncurl_close($curl);\n\nif ($err) {\n  echo "Error: " . $err;\n} else {\n  echo $response;\n}`
      }
      case 'php-guzzle': {
        const isJson = body_type.includes('json')
        const bodyOption = hasBody
          ? isJson
            ? `\n  'json' => json_decode('${bodyStr.replace(/'/g, "\\'")}', true),`
            : `\n  'body' => '${bodyStr.replace(/'/g, "\\'")}',`
          : ''
        const headerLines = Object.entries(headers).map(([k, v]) => `    '${k}' => '${v}',`).join('\n')
        return `<?php\nrequire 'vendor/autoload.php';\nuse GuzzleHttp\\Client;\n\n$client = new Client();\n$response = $client->request('${method}', '${url}', [${bodyOption}\n  'headers' => [\n${headerLines}\n  ],\n]);\n\necho $response->getStatusCode();\necho $response->getBody();`
      }
      case 'java-okhttp': {
        const mediaType = headers['Content-Type'] || headers['content-type'] || 'application/json'
        const bodyCode = hasBody
          ? `MediaType mediaType = MediaType.parse("${mediaType}");\nRequestBody body = RequestBody.create(mediaType, "${bodyStr.replace(/"/g, '\\"').replace(/\n/g, '\\n')}");\n`
          : ''
        const headerLines = Object.entries(headers).map(([k, v]) => `  .addHeader("${k}", "${v}")`).join('\n')
        return `import okhttp3.*;\n\nOkHttpClient client = new OkHttpClient();\n\n${bodyCode}Request request = new Request.Builder()\n  .url("${url}")\n  .method("${method}", ${hasBody ? 'body' : 'null'})\n${headerLines}\n  .build();\n\nResponse response = client.newCall(request).execute();\nSystem.out.println(response.body().string());`
      }
      case 'ruby-net-http': {
        const urlVar = `uri = URI("${url}")`
        const headerLines = Object.entries(headers).map(([k, v]) => `request["${k}"] = "${v}"`).join('\n')
        return `require "uri"\nrequire "net/http"\nrequire "json"\n\n${urlVar}\nhttp = Net::HTTP.new(uri.host, uri.port)\nhttp.use_ssl = uri.scheme == "https"\n\nrequest = Net::HTTP::${method.charAt(0).toUpperCase() + method.slice(1).toLowerCase()}.new(uri)\n${headerLines}${hasBody ? `\nrequest.body = '${bodyStr.replace(/'/g, "\\'")}'` : ''}\n\nresponse = http.request(request)\nputs response.code\nputs response.body`
      }
      case 'csharp-restsharp': {
        const headerLines = Object.entries(headers).map(([k, v]) => `request.AddHeader("${k}", "${v}");`).join('\n')
        return `using RestSharp;\n\nvar client = new RestClient("${url}");\nvar request = new RestRequest(Method.${method.toUpperCase()});\n${headerLines}${hasBody ? `\nrequest.AddParameter("application/json", @"${bodyStr.replace(/"/g, '\\"')}", ParameterType.RequestBody);` : ''}\n\nIRestResponse response = client.Execute(request);\nConsole.WriteLine(response.Content);`
      }
      default: return `// Snippet for ${selectedLang} coming soon...`
    }
  }, [selectedLang, requestData])

  const handleCopy = () => {
    navigator.clipboard.writeText(codeSnippet)
    setCopied(true)
    toast.success('Copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-5xl bg-surface border border-border rounded-2xl shadow-2xl z-[160] overflow-hidden flex flex-col max-h-[90vh]">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary"><Code size={18} /></div>
              <Dialog.Title className="text-sm font-bold text-text uppercase tracking-widest">Generate Code Snippet</Dialog.Title>
            </div>
            <Dialog.Close className="text-muted hover:text-text transition-colors"><X size={20} /></Dialog.Close>
          </div>

          <div className="flex-1 flex overflow-hidden">
            <div className="w-64 border-r border-border bg-background/30 p-4 flex flex-col gap-6 overflow-y-auto shrink-0">
               {['Shell', 'JavaScript', 'Backend'].map(group => (
                 <div key={group}>
                    <h5 className="px-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted/50 mb-3">{group}</h5>
                    <div className="flex flex-col gap-1">
                      {LANGUAGES.filter(l => l.group === group).map(lang => (
                        <button
                          key={lang.id}
                          onClick={() => setSelectedLang(lang.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left text-xs font-bold transition-all ${selectedLang === lang.id ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-muted hover:bg-surface hover:text-text'}`}
                        >
                          <lang.icon size={14} className={selectedLang === lang.id ? 'text-white' : 'text-muted/50'} />
                          {lang.label}
                        </button>
                      ))}
                    </div>
                 </div>
               ))}
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
              <Editor
                height="100%"
                language={
                  selectedLang.startsWith('js') || selectedLang === 'node-axios' ? 'javascript'
                  : selectedLang === 'go-native' ? 'go'
                  : selectedLang === 'python-requests' ? 'python'
                  : selectedLang === 'java-okhttp' ? 'java'
                  : selectedLang === 'csharp-restsharp' ? 'csharp'
                  : selectedLang === 'php-curl' || selectedLang === 'php-guzzle' ? 'php'
                  : selectedLang === 'ruby-net-http' ? 'ruby'
                  : 'shell'
                }
                theme={monacoTheme}
                value={codeSnippet}
                options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, automaticLayout: true, padding: { top: 20 }, scrollBeyondLastLine: false, wordWrap: 'on' }}
              />
              <button onClick={handleCopy} className="absolute top-4 right-8 p-3 bg-surface border border-border rounded-2xl text-muted hover:text-white hover:border-primary shadow-2xl z-10 transition-all">
                {copied ? <Check size={20} className="text-success" /> : <Copy size={20} />}
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
