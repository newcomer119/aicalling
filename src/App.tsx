import React, { useEffect, useRef, useState } from 'react';
import { Phone, CheckCircle, AlertCircle, Loader2, Upload, FileText, Play, Pause, SkipForward, History, Download, MessageSquare, Clock, User } from 'lucide-react';

import * as XLSX from 'xlsx';
import Analytics from './Analytics';

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

interface ExecutionData {
  execution_id: string;
  agent_id: string;
  recipient_phone_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  duration?: number;
  recording_url?: string;
  transcript?: string;
  conversation?: any[];
  metadata?: any;
}

interface RatingData {
  rating: number;
  count: number;
  percentage: number;
}

interface FeedbackData {
  category: string;
  positive: number;
  negative: number;
  neutral: number;
  total: number;
}

interface SurveyAnalytics {
  totalCalls: number;
  averageRating: number;
  satisfactionRate: number;
  feedbackCategories: FeedbackData[];
  languageUsage: { english: number; hindi: number; both: number };
  callDuration: { short: number; medium: number; long: number };
  responseRate: number;
}

function App() {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'logs' | 'analytics'>('single');
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
  const [executions, setExecutions] = useState<ExecutionData[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [selectedCall, setSelectedCall] = useState<any>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [ratingData, setRatingData] = useState<RatingData[]>([]);
  const [totalCalls, setTotalCalls] = useState(0);
  const [averageRating, setAverageRating] = useState(0);

  // Enhanced analytics states
  const [surveyAnalytics, setSurveyAnalytics] = useState<SurveyAnalytics>({
    totalCalls: 0,
    averageRating: 0,
    satisfactionRate: 0,
    feedbackCategories: [],
    languageUsage: { english: 0, hindi: 0, both: 0 },
    callDuration: { short: 0, medium: 0, long: 0 },
    responseRate: 0
  });
  const [feedbackData, setFeedbackData] = useState<FeedbackData[]>([]);

  const AUTH_TOKEN = 'bn-69e9b7cc1a154869931c241d795b050f';
  const AGENT_ID = '3e0767cb-3020-4355-a269-58bea73ca685';

  useEffect(() => {
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

  // Helper functions
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

  const downloadRecording = async (url: string, executionId?: string) => {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = executionId ? `${executionId}.mp3` : 'recording.mp3';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (error) {
      console.error('Download error', error);
      setStatus({ type: 'error', message: 'Unable to download recording.' });
    }
  };

  const extractRatingFromConversation = (conversation: any): number | null => {
    if (!conversation) return null;
    
    let conversationText = '';
    
    // Handle the complex Bolna API data structure
    if (conversation.data && Array.isArray(conversation.data)) {
      // Extract user responses from transcriber data
      const userResponses = conversation.data
        .filter((item: any) => item.component === 'transcriber' && item.type === 'response')
        .map((item: any) => item.data)
        .join(' ');
      
      // Extract agent responses from LLM data
      const agentResponses = conversation.data
        .filter((item: any) => item.component === 'llm' && item.type === 'response')
        .map((item: any) => item.data)
        .join(' ');
      
      conversationText = `${userResponses} ${agentResponses}`;
    } else if (typeof conversation === 'string') {
      conversationText = conversation;
    } else {
      conversationText = JSON.stringify(conversation);
    }
    
    // Look for rating patterns in the conversation (NPS scale 0-10)
    const ratingPatterns = [
      /rate.*?(\d+).*?out.*?of.*?(\d+)/i,
      /rating.*?(\d+)/i,
      /score.*?(\d+)/i,
      /(\d+).*?stars?/i,
      /(\d+).*?out.*?of.*?(\d+)/i,
      /give.*?(\d+)/i,
      /nps.*?(\d+)/i,
      /satisfaction.*?(\d+)/i,
      /(\d+).*?scale/i,
      /scale.*?(\d+)/i,
      /around.*?(\d+)/i,
      /(\d+).*?out.*?of.*?(\d+)/i,
      /(\d+)\s*(\d+)/i, // For cases like "nine nine" = 99, but we'll take first number
      /(\d+)/i // General number detection
    ];

    for (const pattern of ratingPatterns) {
      const match = conversationText.match(pattern);
      if (match) {
        const rating = parseInt(match[1]);
        // Handle NPS scale 0-10
        if (rating >= 0 && rating <= 10) {
          return rating;
        }
      }
    }

    return null;
  };

  const processRatingData = (executions: ExecutionData[]) => {
    const ratings: { [key: number]: number } = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
    let totalRatings = 0;
    let totalScore = 0;

    executions.forEach(execution => {
      const rating = extractRatingFromConversation(execution.conversation || execution.transcript);
      if (rating !== null && rating >= 0 && rating <= 10) {
        ratings[rating]++;
        totalRatings++;
        totalScore += rating;
      }
    });

    const ratingData: RatingData[] = Object.entries(ratings).map(([rating, count]) => ({
      rating: parseInt(rating),
      count,
      percentage: totalRatings > 0 ? Math.round((count / totalRatings) * 100) : 0
    }));

    setRatingData(ratingData);
    setTotalCalls(totalRatings);
    setAverageRating(totalRatings > 0 ? Math.round((totalScore / totalRatings) * 10) / 10 : 0);
  };

  const extractFeedbackData = (conversation: any): any => {
    if (!conversation) return null;
    
    let conversationText = '';
    
    // Handle the complex Bolna API data structure
    if (conversation.data && Array.isArray(conversation.data)) {
      // Extract user responses from transcriber data
      const userResponses = conversation.data
        .filter((item: any) => item.component === 'transcriber' && item.type === 'response')
        .map((item: any) => item.data)
        .join(' ');
      
      conversationText = userResponses;
    } else if (typeof conversation === 'string') {
      conversationText = conversation;
    } else {
      conversationText = JSON.stringify(conversation);
    }
    
    const feedback = {
      website: { positive: 0, negative: 0, neutral: 0 },
      seo: { positive: 0, negative: 0, neutral: 0 },
      socialMedia: { positive: 0, negative: 0, neutral: 0 },
      content: { positive: 0, negative: 0, neutral: 0 },
      marketing: { positive: 0, negative: 0, neutral: 0 },
      overall: { positive: 0, negative: 0, neutral: 0 }
    };

    // Website feedback
    if (conversationText.match(/website.*?(good|great|excellent|amazing|wonderful|fantastic|perfect|well done)/i)) {
      feedback.website.positive++;
    } else if (conversationText.match(/website.*?(bad|poor|terrible|awful|horrible|disappointing)/i)) {
      feedback.website.negative++;
    } else if (conversationText.match(/website/i)) {
      feedback.website.neutral++;
    }

    // SEO feedback - look for Google visibility and search results
    if (conversationText.match(/seo.*?(good|great|excellent|amazing|wonderful|fantastic|perfect|well done)/i) ||
        conversationText.match(/google.*?(see|visible|appear|show|find)/i) ||
        conversationText.match(/search.*?(result|appear|visible)/i)) {
      feedback.seo.positive++;
    } else if (conversationText.match(/seo.*?(bad|poor|terrible|awful|horrible|disappointing)/i)) {
      feedback.seo.negative++;
    } else if (conversationText.match(/seo|google|search/i)) {
      feedback.seo.neutral++;
    }

    // Social Media feedback
    if (conversationText.match(/social.*?media.*?(good|great|excellent|amazing|wonderful|fantastic|perfect|well done)/i)) {
      feedback.socialMedia.positive++;
    } else if (conversationText.match(/social.*?media.*?(bad|poor|terrible|awful|horrible|disappointing)/i)) {
      feedback.socialMedia.negative++;
    } else if (conversationText.match(/social.*?media/i)) {
      feedback.socialMedia.neutral++;
    }

    // Content feedback
    if (conversationText.match(/content.*?(good|great|excellent|amazing|wonderful|fantastic|perfect|well done)/i)) {
      feedback.content.positive++;
    } else if (conversationText.match(/content.*?(bad|poor|terrible|awful|horrible|disappointing)/i)) {
      feedback.content.negative++;
    } else if (conversationText.match(/content/i)) {
      feedback.content.neutral++;
    }

    // Marketing feedback
    if (conversationText.match(/marketing.*?(good|great|excellent|amazing|wonderful|fantastic|perfect|well done)/i)) {
      feedback.marketing.positive++;
    } else if (conversationText.match(/marketing.*?(bad|poor|terrible|awful|horrible|disappointing)/i)) {
      feedback.marketing.negative++;
    } else if (conversationText.match(/marketing/i)) {
      feedback.marketing.neutral++;
    }

    // Overall satisfaction - look for positive phrases and ratings
    if (conversationText.match(/(satisfied|happy|pleased|content|good|great|excellent|well done|everything was good|no issues)/i)) {
      feedback.overall.positive++;
    } else if (conversationText.match(/(dissatisfied|unhappy|disappointed|frustrated|bad|poor|issues|problems)/i)) {
      feedback.overall.negative++;
    } else {
      feedback.overall.neutral++;
    }

    return feedback;
  };

  const analyzeLanguageUsage = (conversation: any): 'english' | 'hindi' | 'both' => {
    if (!conversation) return 'english';
    
    let conversationText = '';
    
    // Handle the complex Bolna API data structure
    if (conversation.data && Array.isArray(conversation.data)) {
      // Extract user responses from transcriber data
      const userResponses = conversation.data
        .filter((item: any) => item.component === 'transcriber' && item.type === 'response')
        .map((item: any) => item.data)
        .join(' ');
      
      conversationText = userResponses;
    } else if (typeof conversation === 'string') {
      conversationText = conversation;
    } else {
      conversationText = JSON.stringify(conversation);
    }
    
    const hindiPatterns = [
      /[अ-ह]/,
      /[ा-ौ]/,
      /[्]/,
      /[ं]/,
      /[ँ]/
    ];
    
    const hasHindi = hindiPatterns.some(pattern => pattern.test(conversationText));
    const hasEnglish = /[a-zA-Z]/.test(conversationText);
    
    if (hasHindi && hasEnglish) return 'both';
    if (hasHindi) return 'hindi';
    return 'english';
  };

  const categorizeCallDuration = (duration: number): 'short' | 'medium' | 'long' => {
    if (duration < 180) return 'short'; // Less than 3 minutes
    if (duration < 300) return 'medium'; // 3-5 minutes
    return 'long'; // More than 5 minutes
  };

  const createReadableConversation = (conversation: any): any[] => {
    if (!conversation) return [];
    
    // Handle the complex Bolna API data structure
    if (conversation.data && Array.isArray(conversation.data)) {
      const messages: any[] = [];
      
      // Group related messages by timestamp
      const groupedMessages = conversation.data.reduce((acc: any, item: any) => {
        const timestamp = item.created_at;
        if (!acc[timestamp]) {
          acc[timestamp] = [];
        }
        acc[timestamp].push(item);
        return acc;
      }, {});
      
      // Process each timestamp group
      Object.entries(groupedMessages).forEach(([timestamp, items]: [string, any]) => {
        const transcriberItem = items.find((item: any) => item.component === 'transcriber' && item.type === 'response');
        const llmItem = items.find((item: any) => item.component === 'llm' && item.type === 'response');
        
        if (transcriberItem) {
          messages.push({
            role: 'user',
            content: transcriberItem.data,
            timestamp: timestamp
          });
        }
        
        if (llmItem) {
          messages.push({
            role: 'assistant',
            content: llmItem.data,
            timestamp: timestamp
          });
        }
      });
      
      return messages;
    }
    
    // Fallback for other conversation formats
    if (Array.isArray(conversation)) {
      return conversation;
    }
    
    return [];
  };

  const renderConversation = (selectedCall: any) => {
    const readableConversation = createReadableConversation(selectedCall.conversation);
    
    if (readableConversation.length > 0) {
      return (
        <div className="space-y-4">
          {readableConversation.map((message: any, index: number) => (
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
      );
    } else if (selectedCall.transcript) {
      return (
        <div className="prose max-w-none">
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Full Transcript:</h3>
            <p className="text-gray-700 whitespace-pre-wrap">{selectedCall.transcript}</p>
          </div>
        </div>
      );
    } else {
      return (
        <div className="text-center py-8">
          <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600">No conversation data available for this call</p>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">Raw Data:</h4>
            <pre className="text-xs text-gray-600 overflow-auto">{JSON.stringify(selectedCall, null, 2)}</pre>
          </div>
        </div>
      );
    }
  };

  const processSurveyAnalytics = (executions: ExecutionData[]) => {
    const feedbackCategories: FeedbackData[] = [
      { category: 'Website', positive: 0, negative: 0, neutral: 0, total: 0 },
      { category: 'SEO', positive: 0, negative: 0, neutral: 0, total: 0 },
      { category: 'Social Media', positive: 0, negative: 0, neutral: 0, total: 0 },
      { category: 'Content', positive: 0, negative: 0, neutral: 0, total: 0 },
      { category: 'Marketing', positive: 0, negative: 0, neutral: 0, total: 0 },
      { category: 'Overall', positive: 0, negative: 0, neutral: 0, total: 0 }
    ];

    const languageUsage = { english: 0, hindi: 0, both: 0 };
    const callDuration = { short: 0, medium: 0, long: 0 };
    let totalCalls = 0;
    let totalRating = 0;
    let totalScore = 0;

    executions.forEach(execution => {
      if (execution.status === 'completed') {
        totalCalls++;
        
        // Extract rating
        const rating = extractRatingFromConversation(execution.conversation || execution.transcript);
        if (rating !== null) {
          totalRating++;
          totalScore += rating;
        }

        // Extract feedback
        const feedback = extractFeedbackData(execution.conversation || execution.transcript);
        if (feedback) {
          feedbackCategories[0].positive += feedback.website.positive;
          feedbackCategories[0].negative += feedback.website.negative;
          feedbackCategories[0].neutral += feedback.website.neutral;
          
          feedbackCategories[1].positive += feedback.seo.positive;
          feedbackCategories[1].negative += feedback.seo.negative;
          feedbackCategories[1].neutral += feedback.seo.neutral;
          
          feedbackCategories[2].positive += feedback.socialMedia.positive;
          feedbackCategories[2].negative += feedback.socialMedia.negative;
          feedbackCategories[2].neutral += feedback.socialMedia.neutral;
          
          feedbackCategories[3].positive += feedback.content.positive;
          feedbackCategories[3].negative += feedback.content.negative;
          feedbackCategories[3].neutral += feedback.content.neutral;
          
          feedbackCategories[4].positive += feedback.marketing.positive;
          feedbackCategories[4].negative += feedback.marketing.negative;
          feedbackCategories[4].neutral += feedback.marketing.neutral;
          
          feedbackCategories[5].positive += feedback.overall.positive;
          feedbackCategories[5].negative += feedback.overall.negative;
          feedbackCategories[5].neutral += feedback.overall.neutral;
        }

        // Analyze language usage
        const language = analyzeLanguageUsage(execution.conversation || execution.transcript);
        languageUsage[language]++;

        // Categorize call duration
        if (execution.duration) {
          const durationCategory = categorizeCallDuration(execution.duration);
          callDuration[durationCategory]++;
        }
      }
    });

    // Calculate totals for each category
    feedbackCategories.forEach(category => {
      category.total = category.positive + category.negative + category.neutral;
    });

    const analytics: SurveyAnalytics = {
      totalCalls,
      averageRating: totalRating > 0 ? Math.round((totalScore / totalRating) * 10) / 10 : 0,
      satisfactionRate: totalRating > 0 ? Math.round(((feedbackCategories[5].positive) / totalRating) * 100) : 0,
      feedbackCategories,
      languageUsage,
      callDuration,
      responseRate: totalCalls > 0 ? Math.round((totalRating / totalCalls) * 100) : 0
    };

    setSurveyAnalytics(analytics);
    setFeedbackData(feedbackCategories);
  };

  const fetchAllExecutions = async () => {
    setIsLoadingLogs(true);
    setExecutions([]);

    try {
      const response = await fetch(`https://api.bolna.ai/v2/agent/${AGENT_ID}/executions`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle different response formats
      const executionsList = Array.isArray(data) ? data : 
                           data.executions ? data.executions : 
                           data.data ? data.data : [data];

      // Fetch detailed data for each execution
      const detailedExecutions = await Promise.all(
        executionsList.map(async (execution: any) => {
          try {
            const detailResponse = await fetch(`https://api.bolna.ai/executions/${execution.execution_id || execution.id}/log`, {
              headers: {
                'Authorization': `Bearer ${AUTH_TOKEN}`,
                'Content-Type': 'application/json'
              }
            });
            
            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              return {
                ...execution,
                ...detailData,
                execution_id: execution.execution_id || execution.id
              };
            }
            return execution;
          } catch (error) {
            console.error('Error fetching execution details:', error);
            return execution;
          }
        })
      );

      setExecutions(detailedExecutions);
      processRatingData(detailedExecutions);
      processSurveyAnalytics(detailedExecutions);
    } catch (error) {
      console.error('Error fetching executions:', error);
      setStatus({ type: 'error', message: 'Unable to fetch call logs. Please check your connection.' });
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const fetchExecutionDetails = async (executionId: string) => {
    try {
      setShowConversation(true);
      setSelectedCall(null);

      const response = await fetch(`https://api.bolna.ai/executions/${executionId}/log`, {
        headers: {
          'Authorization': `Bearer ${AUTH_TOKEN}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();
      setSelectedCall({
        ...data,
        execution_id: executionId
      });
    } catch (error) {
      console.error('Error fetching execution details:', error);
      setStatus({ type: 'error', message: 'Unable to fetch call details.' });
      setShowConversation(false);
    }
  };

  const downloadExecutionData = (execution: ExecutionData) => {
    const dataStr = JSON.stringify(execution, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `execution-${execution.execution_id}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllExecutions = () => {
    const dataStr = JSON.stringify(executions, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all-executions-${AGENT_ID}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportAnalytics = () => {
    const analyticsData = {
      timestamp: new Date().toISOString(),
      agent_id: AGENT_ID,
      summary: surveyAnalytics,
      feedback_data: feedbackData,
      rating_data: ratingData
    };
    const dataStr = JSON.stringify(analyticsData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${AGENT_ID}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatus({ type: 'success', message: 'Analytics data exported successfully!' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0 bg-grid-pattern" />
      </div>

      <div className="relative z-10 w-full max-w-6xl">
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
              Call Logs
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-2 rounded-md font-medium transition-all duration-200 ${
                activeTab === 'analytics'
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Analytics
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
        ) : activeTab === 'logs' ? (
          // Call Logs Interface
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <div className="p-8 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                    <History className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">Call Logs</h1>
                    <p className="text-gray-600">View all call executions, recordings, and conversations</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <button onClick={fetchAllExecutions} disabled={isLoadingLogs} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center space-x-2">
                    {isLoadingLogs ? <Loader2 className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />} 
                    <span>Refresh</span>
                  </button>
                  {executions.length > 0 && (
                    <>
                      <button onClick={downloadAllExecutions} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2">
                        <Download className="w-4 h-4" />
                        <span>Download All Data</span>
                      </button>
                      <button 
                        onClick={() => {
                          const recordings = executions.filter(e => e.recording_url);
                          if (recordings.length > 0) {
                            recordings.forEach((execution, index) => {
                              setTimeout(() => {
                                downloadRecording(execution.recording_url!, execution.execution_id);
                              }, index * 1000);
                            });
                            setStatus({ type: 'success', message: `Downloading ${recordings.length} recordings...` });
                          } else {
                            setStatus({ type: 'error', message: 'No recordings available to download' });
                          }
                        }}
                        className="bg-purple-500 text-white px-4 py-2 rounded-lg hover:bg-purple-600 transition-colors flex items-center space-x-2"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download All Recordings</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
              
              <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-blue-900">Agent ID</h3>
                    <p className="text-sm text-blue-700 font-mono">{AGENT_ID}</p>
                  </div>
                  <div className="text-right">
                    <h3 className="font-medium text-blue-900">Total Executions</h3>
                    <p className="text-2xl font-bold text-blue-700">{executions.length}</p>
                  </div>
                </div>
                {status.type && (
                  <div className={`mt-3 p-3 rounded-lg flex items-start space-x-3 ${
                    status.type === 'success'
                      ? 'bg-green-100 border border-green-200'
                      : 'bg-red-100 border border-red-200'
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
              </div>
            </div>

            <div className="p-8">
              {status.type && (
                <div className={`mb-6 p-4 rounded-lg flex items-start space-x-3 ${
                  status.type === 'success'
                    ? 'bg-green-100 border border-green-200'
                    : 'bg-red-100 border border-red-200'
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
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  <span className="ml-3 text-gray-600">Loading call logs...</span>
                </div>
              ) : executions.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No call logs found</h3>
                  <p className="text-gray-600">Make some calls to see them appear here</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {executions.map((execution, index) => (
                    <div key={execution.execution_id || index} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            execution.status === 'completed' ? 'bg-green-100' :
                            execution.status === 'failed' ? 'bg-red-100' :
                            execution.status === 'in_progress' ? 'bg-blue-100' :
                            'bg-gray-100'
                          }`}>
                            <User className={`w-5 h-5 ${
                              execution.status === 'completed' ? 'text-green-600' :
                              execution.status === 'failed' ? 'text-red-600' :
                              execution.status === 'in_progress' ? 'text-blue-600' :
                              'text-gray-600'
                            }`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{execution.recipient_phone_number || 'Unknown Number'}</h3>
                            <p className="text-sm text-gray-600">{formatDate(execution.created_at)}</p>
                            <p className="text-xs text-gray-500 font-mono">ID: {execution.execution_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            execution.status === 'completed' ? 'bg-green-100 text-green-800' :
                            execution.status === 'failed' ? 'bg-red-100 text-red-800' :
                            execution.status === 'in_progress' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>{execution.status || 'Unknown'}</span>
                          {execution.duration && (
                            <div className="flex items-center text-sm text-gray-600">
                              <Clock className="w-4 h-4 mr-1" />
                              {formatDuration(execution.duration)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {execution.recording_url && (
                            <>
                              <button onClick={() => downloadRecording(execution.recording_url!, execution.execution_id)} className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors">
                                <Download className="w-4 h-4" />
                                <span className="text-sm">Download Recording</span>
                              </button>
                              <audio controls className="h-8">
                                <source src={execution.recording_url} type="audio/mpeg" />
                                Your browser does not support the audio element.
                              </audio>
                            </>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          <button onClick={() => fetchExecutionDetails(execution.execution_id)} className="flex items-center space-x-2 bg-gray-100 text-gray-700 px-3 py-1 rounded-lg hover:bg-gray-200 transition-colors">
                            <MessageSquare className="w-4 h-4" />
                            <span className="text-sm">View Conversation</span>
                          </button>
                          <button onClick={() => downloadExecutionData(execution)} className="flex items-center space-x-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-lg hover:bg-blue-200 transition-colors">
                            <Download className="w-4 h-4" />
                            <span className="text-sm">Download Data</span>
                          </button>
                        </div>
                      </div>

                      {execution.transcript && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                          <h4 className="font-medium text-gray-900 mb-2">Quick Preview:</h4>
                          <p className="text-sm text-gray-700 line-clamp-3">{String(execution.transcript).substring(0, 200)}...</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <Analytics
            executions={executions}
            isLoadingLogs={isLoadingLogs}
            surveyAnalytics={surveyAnalytics}
            feedbackData={feedbackData}
            ratingData={ratingData}
            onRefresh={fetchAllExecutions}
            onExportAnalytics={exportAnalytics}
            status={status}
            AGENT_ID={AGENT_ID}
          />
        )}
      </div>

      {/* Conversation Modal */}
      {showConversation && selectedCall && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Call Conversation</h2>
                <p className="text-gray-600">
                  {selectedCall.recipient_phone_number || 'Unknown Number'} • {formatDate(selectedCall.created_at)}
                </p>
                <p className="text-xs text-gray-500 font-mono">Execution ID: {selectedCall.execution_id}</p>
              </div>
              <div className="flex items-center space-x-2">
                <button onClick={() => downloadExecutionData(selectedCall)} className="bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600 transition-colors flex items-center space-x-1">
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Download</span>
                </button>
                <button onClick={() => setShowConversation(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[70vh]">
              {renderConversation(selectedCall)}
            </div>

            {selectedCall.recording_url && (
              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-gray-900">Call Recording</h3>
                  <button onClick={() => downloadRecording(selectedCall.recording_url, selectedCall.execution_id)} className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 transition-colors">
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