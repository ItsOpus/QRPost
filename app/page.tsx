"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Smartphone, RefreshCw, Copy, ExternalLink, Trash2, Wifi, WifiOff, Zap } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export default function HomePage() {
  const [sessionId, setSessionId] = useState<string>("")
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("")
  const [receivedContent, setReceivedContent] = useState<
    Array<{
      id: string
      content: string
      type: "text" | "link"
      timestamp: number
    }>
  >([])
  const [isConnected, setIsConnected] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [connectionRetries, setConnectionRetries] = useState(0)
  const { toast } = useToast()

  const generateSession = async () => {
    setIsGenerating(true)
    try {
      const response = await fetch("/api/session", { method: "POST" })
      const data = await response.json()
      setSessionId(data.sessionId)
      setQrCodeUrl(data.qrCode)
      setReceivedContent([])
      setConnectionRetries(0)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to generate session",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const refreshSession = async () => {
    if (!sessionId) return

    try {
      const response = await fetch(`/api/session/${sessionId}`)
      if (!response.ok) {
        await generateSession()
        toast({
          title: "Session Refreshed",
          description: "Your session was refreshed due to expiration",
        })
      }
    } catch (error) {
      await generateSession()
    }
  }

  const clearReceivedContent = () => {
    setReceivedContent([])
    toast({
      title: "Cleared",
      description: "Received content cleared",
    })
  }

  useEffect(() => {
    generateSession()
  }, [])

  useEffect(() => {
    if (!sessionId) return

    let eventSource: EventSource | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null

    const connectToSession = () => {
      if (eventSource) {
        eventSource.close()
      }

      eventSource = new EventSource(`/api/listen/${sessionId}`)

      eventSource.onopen = () => {
        console.log("SSE connection opened")
        setIsConnected(true)
        setConnectionRetries(0)
      }

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)

        if (data.type === "content") {
          const newItem = {
            id: Math.random().toString(36).substr(2, 9),
            content: data.content,
            type: data.contentType,
            timestamp: Date.now(),
          }

          setReceivedContent((prev) => [newItem, ...prev])

          toast({
            title: "Content Received! 🎉",
            description: `New ${data.contentType} received from sender device`,
          })
        } else if (data.type === "heartbeat") {
          console.log("Heartbeat received")
        }
      }

      eventSource.onerror = (error) => {
        console.log("SSE connection error:", error)
        setIsConnected(false)

        // Attempt to reconnect with exponential backoff
        if (connectionRetries < 5) {
          const delay = Math.min(1000 * Math.pow(2, connectionRetries), 30000)
          console.log(`Reconnecting in ${delay}ms...`)

          reconnectTimeout = setTimeout(() => {
            setConnectionRetries((prev) => prev + 1)
            connectToSession()
          }, delay)
        }
      }
    }

    connectToSession()

    return () => {
      if (eventSource) {
        eventSource.close()
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout)
      }
    }
  }, [sessionId, connectionRetries, toast])

  useEffect(() => {
    if (!sessionId) return

    const interval = setInterval(refreshSession, 30 * 60 * 1000)
    return () => clearInterval(interval)
  }, [sessionId])

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied! 📋",
        description: "Content copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      })
    }
  }

  const openLink = (url: string) => {
    const fullUrl = url.startsWith("http") ? url : `https://${url}`
    window.open(fullUrl, "_blank")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-cyan-500 rounded-xl flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-cyan-600 bg-clip-text text-transparent">
                  QR Transfer
                </h1>
                <p className="text-sm text-gray-600">Instant cross-device transfer</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge
                variant={isConnected ? "default" : "secondary"}
                className={`transition-all duration-300 ${
                  isConnected
                    ? "bg-green-100 text-green-800 border-green-200"
                    : "bg-gray-100 text-gray-600 border-gray-200"
                }`}
              >
                {isConnected ? (
                  <>
                    <Wifi className="w-3 h-3 mr-1" />
                    Connected
                  </>
                ) : (
                  <>
                    <WifiOff className="w-3 h-3 mr-1" />
                    {connectionRetries > 0 ? `Reconnecting... (${connectionRetries}/5)` : "Waiting"}
                  </>
                )}
              </Badge>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* QR Code Section */}
          <div className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-xl">Device 1 - Receiver</CardTitle>
                    <CardDescription className="text-sm">
                      Scan with your second device to start transferring
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    variant="outline"
                    onClick={refreshSession}
                    className="flex-1 transition-all duration-200 hover:scale-105"
                    disabled={isGenerating}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} />
                    Refresh
                  </Button>
                  <Button
                    onClick={generateSession}
                    className="flex-1 bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 hover:scale-105"
                    disabled={isGenerating}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} />
                    New Session
                  </Button>
                </div>

                {qrCodeUrl && (
                  <div className="flex justify-center">
                    <div className="relative group">
                      <div className="absolute -inset-4 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                      <div className="relative bg-white p-6 rounded-2xl shadow-lg">
                        <img
                          src={qrCodeUrl || "/placeholder.svg"}
                          alt="QR Code"
                          className="w-48 h-48 sm:w-56 sm:h-56 transition-transform duration-300 group-hover:scale-105"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {sessionId && (
                  <div className="text-center p-4 bg-gray-50 rounded-xl">
                    <p className="text-xs text-gray-500 font-mono">Session ID</p>
                    <p className="text-sm font-medium text-gray-700 break-all">{sessionId}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Received Content Section */}
          <div className="space-y-6">
            <Card className="border-0 shadow-xl bg-white/70 backdrop-blur-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                      <div className="w-4 h-4 bg-white rounded-full"></div>
                    </div>
                    <div>
                      <CardTitle className="text-xl">
                        Received Content
                        {receivedContent.length > 0 && (
                          <Badge variant="secondary" className="ml-2">
                            {receivedContent.length}
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        Content from your sender device appears here
                      </CardDescription>
                    </div>
                  </div>

                  {receivedContent.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearReceivedContent}
                      className="text-gray-500 hover:text-red-500 transition-colors duration-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </CardHeader>

              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
                  {receivedContent.length === 0 ? (
                    <div className="text-center py-12 space-y-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto">
                        <Smartphone className="w-8 h-8 text-gray-400" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-gray-500 font-medium">No content received yet</p>
                        <p className="text-sm text-gray-400">Scan the QR code to get started</p>
                        <p className="text-xs text-gray-400">✨ You can send multiple items in one session</p>
                      </div>
                    </div>
                  ) : (
                    receivedContent.map((item, index) => (
                      <div
                        key={item.id}
                        className="group animate-in slide-in-from-top-2 duration-300"
                        style={{ animationDelay: `${index * 100}ms` }}
                      >
                        <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl p-4 space-y-3 hover:shadow-md transition-all duration-200">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={item.type === "link" ? "default" : "secondary"}
                                className={
                                  item.type === "link"
                                    ? "bg-blue-100 text-blue-800 border-blue-200"
                                    : "bg-purple-100 text-purple-800 border-purple-200"
                                }
                              >
                                {item.type === "link" ? "🔗 Link" : "📝 Text"}
                              </Badge>
                              {item.content.includes("\n") && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-orange-50 text-orange-600 border-orange-200"
                                >
                                  Multi-line
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">
                              {new Date(item.timestamp).toLocaleTimeString()}
                            </span>
                          </div>

                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <pre className="text-sm font-mono whitespace-pre-wrap break-all text-gray-700">
                              {item.content}
                            </pre>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(item.content)}
                              className="flex-1 transition-all duration-200 hover:scale-105"
                            >
                              <Copy className="w-3 h-3 mr-2" />
                              Copy
                            </Button>
                            {item.type === "link" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openLink(item.content)}
                                className="flex-1 transition-all duration-200 hover:scale-105"
                              >
                                <ExternalLink className="w-3 h-3 mr-2" />
                                Open
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        
        @keyframes slide-in-from-top-2 {
          from {
            transform: translateY(-8px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        
        .animate-in {
          animation-fill-mode: both;
        }
        
        .slide-in-from-top-2 {
          animation-name: slide-in-from-top-2;
        }
      `}</style>
    </div>
  )
}
