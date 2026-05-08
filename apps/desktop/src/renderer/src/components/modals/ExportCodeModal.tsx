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
        let bodyCode = ''
        if (hasBody) {
          if (body_type === 'x-www-form-urlencoded' && Array.isArray(body)) {
            bodyCode = `,\n  body: new URLSearchParams(${JSON.stringify(Object.fromEntries((body as any[]).filter(i => i.enabled).map(i => [i.key, i.value])))})`
          } else if (body_type === 'form-data' && Array.isArray(body)) {
            bodyCode = `,\n  body: formData` // Assumption: formData is defined
          } else {
            bodyCode = `,\n  body: ${body_type.includes('json') ? `JSON.stringify(${bodyStr})` : `\`${bodyStr}\``}`
          }
        }
        return `${body_type === 'form-data' && Array.isArray(body) ? 'const formData = new FormData();\n' + (body as any[]).filter(i => i.enabled).map(i => `formData.append("${i.key}", "${i.value}");`).join('\n') + '\n\n' : ''}fetch("${url}", {\n  method: "${method}",\n  headers: ${JSON.stringify(headers, null, 2)}${bodyCode}\n})\n.then(res => res.json())\n.then(console.log);`
      }
      case 'js-axios': {
        let dataProp = ''
        if (hasBody) {
          if (body_type === 'x-www-form-urlencoded' && Array.isArray(body)) {
            dataProp = `,\n  data: new URLSearchParams(${JSON.stringify(Object.fromEntries((body as any[]).filter(i => i.enabled).map(i => [i.key, i.value])))})`
          } else {
            dataProp = `,\n  data: ${body_type.includes('json') ? bodyStr : `\`${bodyStr}\``}`
          }
        }
        return `axios({\n  method: '${method}',\n  url: '${url}',\n  headers: ${JSON.stringify(headers, null, 2)}${dataProp}\n}).then(res => console.log(res.data));`
      }
      case 'js-jquery': {
        return `$.ajax({\n  url: "${url}",\n  method: "${method}",\n  headers: ${JSON.stringify(headers, null, 2)},\n  data: ${hasBody ? (body_type.includes('json') ? bodyStr : `\`${bodyStr}\``) : 'null'}\n}).done(res => console.log(res));`
      }
      case 'node-native': {
        try {
          const urlObj = new URL(url)
          return `const http = require("https");\n\nconst options = {\n  method: "${method}",\n  hostname: "${urlObj.hostname}",\n  path: "${urlObj.pathname}",\n  headers: ${JSON.stringify(headers, null, 2)}\n};\n\nconst req = http.request(options, (res) => {\n  res.on("data", (d) => process.stdout.write(d));\n});\n${hasBody ? `req.write(${body_type.includes('json') ? `JSON.stringify(${bodyStr})` : `\`${bodyStr}\``});` : ''}\nreq.end();`
        } catch (e) {
          return `// Invalid URL for Node Native: ${url}`
        }
      }
      case 'go-native': {
        return `package main\nimport (\n\t"fmt"\n\t"net/http"\n\t"strings"\n)\nfunc main() {\n\tpayload := strings.NewReader(\`${hasBody ? bodyStr : ''}\`)\n\treq, _ := http.NewRequest("${method}", "${url}", payload)\n\t${Object.entries(headers).map(([k, v]) => `req.Header.Add("${k}", "${v}")`).join('\n\t')}\n\tres, _ := http.DefaultClient.Do(req)\n\tdefer res.Body.Close()\n\tfmt.Println(res.Status)\n}`
      }
      case 'python-requests': {
        const isJson = body_type.includes('json')
        return `import requests\n\nurl = "${url}"\npayload = ${hasBody ? (isJson ? bodyStr : `'''${bodyStr}'''`) : 'None'}\nheaders = ${JSON.stringify(headers, null, 2)}\n\nresponse = requests.request("${method}", url, ${isJson ? 'json' : 'data'}=payload, headers=headers)\nprint(response.text)`
      }
      case 'php-curl': {
        return `<?php\n$curl = curl_init();\ncurl_setopt_array($curl, [\n  CURLOPT_URL => "${url}",\n  CURLOPT_CUSTOMREQUEST => "${method}",\n  CURLOPT_POSTFIELDS => '${bodyStr}',\n  CURLOPT_HTTPHEADER => ${JSON.stringify(Object.entries(headers).map(([k, v]) => `${k}: ${v}`))},\n]);\n$response = curl_exec($curl);\ncurl_close($curl);\necho $response;`
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
                language={selectedLang.startsWith('js') ? 'javascript' : selectedLang === 'go-native' ? 'go' : selectedLang === 'python-requests' ? 'python' : 'shell'}
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
