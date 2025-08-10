import React, { useEffect, useRef, useState } from 'react';
import { Phone, CheckCircle, AlertCircle, Loader2, Upload, FileText, Play, Pause, SkipForward, History, Download, MessageSquare, Clock, User } from 'lucide-react';
import * as XLSX from 'xlsx';

interface CallResponse {
  success: boolean;
  message: string;
  call_id?: string;
}

interface BulkCallStatus {
  phone: string;
  status: 'pending' | 'calling' | 'success' | 'error';
  message?: string;
  call_id?: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'logs'>('single');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: ''
  });

  // Bulk calling states
  const [bulkNumbers, setBulkNumbers] = useState<string>('');
  const [bulkCallList, setBulkCallList] = useState<BulkCallStatus[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [currentCallIndex, setCurrentCallIndex] = useState(0);
  const [bulkPaused, setBulkPaused] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkPausedRef = useRef(bulkPaused);
  const isMountedRef = useRef(true);

  // Call logs states
  const [callLogs, setCallLogs] = useState<any[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [showConversation, setShowConversation] = useState(false);

  const AUTH_TOKEN = 'bn-0549201044894a02ab2e8dab891fbe12'; // keep same token as before
  const AGENT_ID = '00377b85-5abc-4189-83d7-88fb44af2bcf';

  useEffect(() => {
    // keep refs in sync for async loops
    bulkPausedRef.current = bulkPaused;
  }, [bulkPaused]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length <= 5) {
      return digits;
    } else {
      return `${digits.slice(0, 5)} ${digits.slice(5, 10)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
    if (status.type) {
      setStatus({ type: null, message: '' });
    }
  };

  const validatePhoneNumber = (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    return digits.length === 10 && /^[6-9]/.test(digits);
  };

  const makeApiCall = async (phoneNumber: string) => {
    const cleanPhone = phoneNumber.replace(/\D/g, '');

    const response = await fetch('https://api.bolna.dev/call', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
      },
      body: JSON.stringify({
        agent_id: AGENT_ID,
        recipient_phone_number: `+91${cleanPhone}`,
        metadata: {
          purpose: 'feedback_collection',
          timestamp: new Date().toISOString()
        }
      }),
    });

    return await response.json();
  };

  const initiateCall = async () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setStatus({ type: 'error', message: 'Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9' });
      return;
    }

    setIsLoading(true);
    setStatus({ type: null, message: '' });

    try {
      const data: CallResponse = await makeApiCall(phoneNumber);

      if (data.success) {
        setStatus({
          type: 'success',
          message: `Call initiated successfully! Our AI agent will call ${phoneNumber} shortly for feedback collection.`
        });
        setPhoneNumber('');
      } else {
        setStatus({
          type: 'error',
          message: data.message || 'Failed to initiate call. Please try again.'
        });
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      setStatus({
        type: 'error',
        message: 'Network error occurred. Please check your connection and try again.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSingleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    initiateCall();
  };

  // Bulk calling functions
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        // Extract phone numbers from the first column or anywhere in the sheet
        const phoneNumbers = jsonData
          .flat()
          .map(cell => String(cell).replace(/\D/g, ''))
          .filter(phone => phone.length === 10 && /^[6-9]/.test(phone))
          .map(phone => formatPhoneNumber(phone));

        setBulkNumbers(phoneNumbers.join('\n'));
        processBulkNumbers(phoneNumbers.join('\n'));
      } catch (error) {
        setStatus({ type: 'error', message: 'Error reading Excel file. Please check the format.' });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const processBulkNumbers = (numbersText: string) => {
    const numbers = numbersText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => {
        const digits = line.replace(/\D/g, '');
        return formatPhoneNumber(digits);
      })
      .filter(phone => validatePhoneNumber(phone));

    const callList: BulkCallStatus[] = numbers.map(phone => ({
      phone,
      status: 'pending'
    }));

    setBulkCallList(callList);
    setCurrentCallIndex(0);
  };

  const startBulkCalling = async () => {
    if (bulkCallList.length === 0) return;

    setIsBulkProcessing(true);
    setBulkPaused(false);

    // iterate from currentCallIndex — use a for-loop and check the ref for pause/unmount
    for (let i = currentCallIndex; i < bulkCallList.length; i++) {
      if (!isMountedRef.current) break;
      if (bulkPausedRef.current) break;

      setCurrentCallIndex(i);

      setBulkCallList(prev => prev.map((item, index) =>
        index === i ? { ...item, status: 'calling' } : item
      ));

      try {
        const data: CallResponse = await makeApiCall(bulkCallList[i].phone);

        setBulkCallList(prev => prev.map((item, index) =>
          index === i ? {
            ...item,
            status: data.success ? 'success' : 'error',
            message: data.message,
            call_id: data.call_id
          } : item
        ));

        // Wait between calls unless paused or finished
        if (i < bulkCallList.length - 1) {
          for (let s = 0; s < 5; s++) {
            if (bulkPausedRef.current || !isMountedRef.current) break;
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } catch (error) {
        setBulkCallList(prev => prev.map((item, index) =>
          index === i ? {
            ...item,
            status: 'error',
            message: 'Network error occurred'
          } : item
        ));
      }
    }

    if (isMountedRef.current) setIsBulkProcessing(false);
  };

  const pauseBulkCalling = () => {
    setBulkPaused(true);
    setIsBulkProcessing(false);
  };

  const resumeBulkCalling = () => {
    setBulkPaused(false);
    startBulkCalling();
  };

  const skipCurrentCall = () => {
    if (currentCallIndex < bulkCallList.length - 1) {
      setBulkCallList(prev => prev.map((item, index) =>
        index === currentCallIndex ? { ...item, status: 'error', message: 'Skipped' } : item
      ));
      setCurrentCallIndex(prev => prev + 1);
    }
  };

  // ---- Missing helper functions added ----

  const formatDate = (iso?: string) => {
    if (!iso) return 'Unknown date';
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch (e) {
      return iso;
    }
  };

  const formatDuration = (seconds: number | string) => {
    const s = typeof seconds === 'string' ? parseInt(seconds, 10) : seconds || 0;
    const mm = Math.floor(s / 60).toString().padStart(2, '0');
    const ss = Math.floor(s % 60).toString().padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const downloadRecording = async (url: string, callId?: string) => {
    try {
      // create an anchor and click it to download
      const a = document.createElement('a');
      a.href = url;
      a.download = callId ? `${callId}.mp3` : 'recording.mp3';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error('Download error', error);
      setStatus({ type: 'error', message: 'Unable to download recording.' });
    }
  };

  const fetchCallLogs = async () => {
    setIsLoadingLogs(true);
    setCallLogs([]);

    try {
      // NOTE: Bolna's public API endpoints for listing calls may differ.
      // This uses GET /call which returned logs in your original implementation context.
      // If Bolna uses a different path (e.g. /calls or /call/logs) replace the URL below.
      const resp = await fetch('https://api.bolna.dev/call?limit=100', {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });

      const data = await resp.json();

      // Expecting an array under data.calls or data.results — try both
      const items = Array.isArray(data) ? data : data.calls || data.results || [];

      setCallLogs(items);
    } catch (error) {
      console.error('Error fetching call logs', error);
      setStatus({ type: 'error', message: 'Unable to fetch call logs.' });
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchCallDetails = async (callId?: string) => {
    if (!callId) {
      setStatus({ type: 'error', message: 'Call ID not available' });
      return;
    }

    try {
      setShowConversation(true);
      setSelectedCall(null);

      // Replace path if your API uses a different shape (e.g. /calls/:id)
      const resp = await fetch(`https://api.bolna.dev/call/${callId}`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`
        }
      });

      const data = await resp.json();

      // Normalize response to expected shape: { conversation, transcript, recording_url, ... }
      const normalized = data && typeof data === 'object' ? data : { transcript: JSON.stringify(data) };
      setSelectedCall(normalized);
    } catch (error) {
      console.error('Error fetching call details', error);
      setStatus({ type: 'error', message: 'Unable to fetch call details.' });
      setShowConversation(false);
    }
  };

  // ---- End helpers ----

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-grid-pattern" />
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-lg p-1 shadow-lg border border-gray-200">
            <button
              onClick={() => setActiveTab('single')}
              className={`px-6 py-2 rounded-md font-medium transition-all duration-200 ${
                activeTab === 'single'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Single Call
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`px-6 py-2 rounded-md font-medium transition-all duration-200 ${
                activeTab === 'bulk'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Bulk Calls
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-6 py-2 rounded-md font-medium transition-all duration-200 ${
                activeTab === 'logs'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Logs
            </button>
          </div>
        </div>

        {activeTab === 'single' ? (
          // Single Call Interface
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <div className="text-center mb-8">
                <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                  <Phone className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Feedback Collection</h1>
                <p className="text-gray-600 text-sm leading-relaxed">Enter your phone number and our AI agent will call you to collect valuable feedback</p>
              </div>

              <form onSubmit={handleSingleSubmit} className="space-y-6">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                  <input
                    type="tel"
                    id="phone"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    placeholder="98765 43210"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-lg"
                    maxLength={11}
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-2">Indian mobile numbers only. We'll call you within a few minutes.</p>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !phoneNumber}
                  className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white py-3 px-4 rounded-lg font-semibold text-lg transition-all duration-200 hover:from-blue-600 hover:to-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 className="animate-spin w-5 h-5 mr-2" />
                      Initiating Call...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center">
                      <Phone className="w-5 h-5 mr-2" />
                      Request Feedback Call
                    </span>
                  )}
                </button>
              </form>

              {status.type && (
                <div className={`mt-6 p-4 rounded-lg flex items-start space-x-3 ${
                  status.type === 'success'
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  {status.type === 'success' ? (
                    <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                  )}
                  <p className={`text-sm ${
                    status.type === 'success' ? 'text-green-800' : 'text-red-800'
                  }`}>{status.message}</p>
                </div>
              )}

              <div className="mt-8 pt-6 border-t border-gray-100">
                <p className="text-xs text-gray-500 text-center leading-relaxed">By requesting a call, you agree to receive automated calls from our AI feedback system. Standard rates may apply.</p>
              </div>
            </div>

            <div className="mt-6 bg-blue-50 rounded-xl p-6 border border-blue-100">
              <h3 className="font-semibold text-blue-900 mb-2">What to expect:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Call duration: 3-5 minutes</li>
                <li>• Our AI will ask about your experience</li>
                <li>• Your feedback helps us improve our services</li>
                <li>• All responses are confidential</li>
              </ul>
            </div>
          </div>
        ) : activeTab === 'bulk' ? (
          // Bulk Call Interface
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center mb-4 shadow-lg">
                <FileText className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Bulk Feedback Collection</h1>
              <p className="text-gray-600 text-sm leading-relaxed">Upload an Excel file or paste a list of phone numbers to call multiple people for feedback</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Upload Excel File</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                    <Upload className="mx-auto w-8 h-8 text-gray-400 mb-2" />
                    <p className="text-sm text-gray-600 mb-2">Click to upload Excel file with phone numbers</p>
                    <input ref={fileInputRef} type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
                    <button onClick={() => fileInputRef.current?.click()} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors">Choose File</button>
                  </div>
                </div>

                <div className="text-center text-gray-500"><span>OR</span></div>

                <div>
                  <label htmlFor="bulkNumbers" className="block text-sm font-medium text-gray-700 mb-2">Paste Phone Numbers (one per line)</label>
                  <textarea
                    id="bulkNumbers"
                    value={bulkNumbers}
                    onChange={(e) => setBulkNumbers(e.target.value)}
                    placeholder={"98765 43210\n87654 32109\n76543 21098"}
                    className="w-full h-32 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    disabled={isBulkProcessing}
                  />
                </div>

                <div className="flex space-x-3">
                  <button
                    onClick={() => processBulkNumbers(bulkNumbers)}
                    disabled={!bulkNumbers.trim() || isBulkProcessing}
                    className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Process Numbers
                  </button>
                  {bulkCallList.length > 0 && !isBulkProcessing && (
                    <button onClick={startBulkCalling} className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center">
                      <Play className="w-4 h-4 mr-2" />
                      Start Calling
                    </button>
                  )}
                  {isBulkProcessing && (
                    <>
                      <button onClick={pauseBulkCalling} className="bg-yellow-500 text-white py-2 px-4 rounded-lg hover:bg-yellow-600 transition-colors flex items-center">
                        <Pause className="w-4 h-4 mr-2" />
                        Pause
                      </button>
                      <button onClick={skipCurrentCall} className="bg-gray-500 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors flex items-center">
                        <SkipForward className="w-4 h-4 mr-2" />
                        Skip
                      </button>
                    </>
                  )}
                  {bulkPaused && (
                    <button onClick={resumeBulkCalling} className="bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors flex items-center">
                      <Play className="w-4 h-4 mr-2" />
                      Resume
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Status ({bulkCallList.filter(item => item.status === 'success').length}/{bulkCallList.length} completed)</h3>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {bulkCallList.map((item, index) => (
                    <div key={index} className={`p-3 rounded-lg border flex items-center justify-between ${
                      item.status === 'pending' ? 'bg-gray-50 border-gray-200' :
                      item.status === 'calling' ? 'bg-blue-50 border-blue-200' :
                      item.status === 'success' ? 'bg-green-50 border-green-200' :
                      'bg-red-50 border-red-200'
                    } ${index === currentCallIndex && isBulkProcessing ? 'ring-2 ring-blue-400' : ''}`}>
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${
                          item.status === 'pending' ? 'bg-gray-400' :
                          item.status === 'calling' ? 'bg-blue-500 animate-pulse' :
                          item.status === 'success' ? 'bg-green-500' :
                          'bg-red-500'
                        }`} />
                        <span className="font-medium">{item.phone}</span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {item.status === 'calling' && <Loader2 className="w-4 h-4 animate-spin" />}
                        {item.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600" />}
                        {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-600" />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {bulkCallList.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Progress</span>
                  <span>{Math.round((bulkCallList.filter(item => item.status !== 'pending').length / bulkCallList.length) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{
                    width: `${(bulkCallList.filter(item => item.status !== 'pending').length / bulkCallList.length) * 100}%`
                  }} />
                </div>
              </div>
            )}
          </div>
        ) : (
          // Logs tab
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="p-8 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                    <History className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Call Logs</h1>
                    <p className="text-gray-600">View call history, recordings, and conversations</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={fetchCallLogs} disabled={isLoadingLogs} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center space-x-2">
                    {isLoadingLogs ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />} 
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="p-8">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-600">Loading call logs...</span>
                </div>
              ) : callLogs.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No call logs found</h3>
                  <p className="text-gray-600">Make some calls to see them appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {callLogs.map((call, index) => (
                    <div key={call.call_id || index} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            call.status === 'completed' ? 'bg-green-100' :
                            call.status === 'failed' ? 'bg-red-100' :
                            call.status === 'in_progress' ? 'bg-blue-100' :
                            'bg-gray-100'
                          }`}>
                            <User className={`w-5 h-5 ${
                              call.status === 'completed' ? 'text-green-600' :
                              call.status === 'failed' ? 'text-red-600' :
                              call.status === 'in_progress' ? 'text-blue-600' :
                              'text-gray-600'
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{call.recipient_phone_number || 'Unknown Number'}</h3>
                            <p className="text-sm text-gray-600">{formatDate(call.created_at || call.timestamp)}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            call.status === 'completed' ? 'bg-green-100 text-green-800' :
                            call.status === 'failed' ? 'bg-red-100 text-red-800' :
                            call.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>{call.status || 'Unknown'}</span>
                          {call.duration && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Clock className="w-4 h-4 mr-1" />
                              {formatDuration(call.duration)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {call.recording_url && (
                            <button onClick={() => downloadRecording(call.recording_url, call.call_id)} className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors">
                              <Download className="w-4 h-4" />
                              <span className="text-sm">Download Recording</span>
                            </button>
                          )}
                          {call.recording_url && (
                            <audio controls className="h-8">
                              <source src={call.recording_url} type="audio/mpeg" />
                              Your browser does not support the audio element.
                            </audio>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => fetchCallDetails(call.call_id)} className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-200 transition-colors">
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-sm">View Conversation</span>
                          </button>
                        </div>
                      </div>

                      {call.transcript && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-2">Quick Preview:</h4>
                          <p className="text-sm text-gray-700 line-clamp-3">{String(call.transcript).substring(0, 200)}...</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showConversation && selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Call Conversation</h2>
                <p className="text-gray-600">{selectedCall.recipient_phone_number} • {formatDate(selectedCall.created_at)}</p>
              </div>
              <button onClick={() => setShowConversation(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {selectedCall.conversation ? (
                <div className="space-y-4">
                  {selectedCall.conversation.map((message: any, index: number) => (
                    <div key={index} className={`flex ${message.role === 'assistant' ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.role === 'assistant' ? 'bg-gray-100 text-gray-900' : 'bg-blue-500 text-white'}`}>
                        <p className="text-sm">{message.content}</p>
                        {message.timestamp && (
                          <p className="text-xs opacity-70 mt-1">{formatDate(message.timestamp)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : selectedCall.transcript ? (
                <div className="prose max-w-none">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Full Transcript:</h3>
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedCall.transcript}</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-600">No conversation data available for this call</p>
                </div>
              )}
            </div>

            {selectedCall.recording_url && (
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Call Recording</h3>
                  <button onClick={() => downloadRecording(selectedCall.recording_url, selectedCall.call_id)} className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors">
                    <Download className="w-4 h-4" />
                    <span className="text-sm">Download</span>
                  </button>
                </div>
                <audio controls className="w-full mt-3">
                  <source src={selectedCall.recording_url} type="audio/mpeg" />
                  Your browser does not support the audio element.
                </audio>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
