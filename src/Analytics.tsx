import React from 'react';
import { Phone, CheckCircle, AlertCircle, Loader2, Download, MessageSquare, Clock, User, BarChart3, Star, TrendingUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

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
  conversation?: any;
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

interface AnalyticsProps {
  executions: ExecutionData[];
  isLoadingLogs: boolean;
  surveyAnalytics: SurveyAnalytics;
  feedbackData: FeedbackData[];
  ratingData: RatingData[];
  onRefresh: () => void;
  onExportAnalytics: () => void;
  status: { type: 'success' | 'error' | null; message: string };
  AGENT_ID: string;
}

const Analytics: React.FC<AnalyticsProps> = ({
  executions,
  isLoadingLogs,
  surveyAnalytics,
  feedbackData,
  ratingData,
  onRefresh,
  onExportAnalytics,
  status,
  AGENT_ID
}) => {
  const formatDate = (iso?: string) => {
    if (!iso) return 'Unknown date';
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch (e) {
      return iso;
    }
  };

  // Debug logging
  console.log('Analytics Component - Received props:', {
    executions: executions.length,
    surveyAnalytics,
    feedbackData: feedbackData.length,
    ratingData: ratingData.length,
    ratingDataDetails: ratingData
  });

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100">
      <div className="p-8 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center shadow-lg">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Feedback Analytics</h1>
              <p className="text-gray-600">Customer satisfaction ratings and insights</p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button onClick={onRefresh} disabled={isLoadingLogs} className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors flex items-center space-x-2">
              {isLoadingLogs ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />} 
              <span>Refresh Data</span>
            </button>
            {surveyAnalytics.totalCalls > 0 && (
              <button onClick={onExportAnalytics} className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 transition-colors flex items-center space-x-2">
                <Download className="w-4 h-4" />
                <span>Export Analytics</span>
              </button>
            )}
          </div>
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
            <span className="ml-3 text-gray-600">Loading analytics...</span>
          </div>
        ) : (ratingData.length === 0 && surveyAnalytics.totalCalls === 0) ? (
          <div className="text-center py-12">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No rating data found</h3>
            <p className="text-gray-600">Make some calls with ratings to see analytics here</p>
            
            {/* Debug section */}
            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left">
              <h4 className="font-medium text-yellow-900 mb-2">Debug Information:</h4>
              <div className="text-sm text-yellow-800 space-y-1">
                <p><strong>Executions:</strong> {executions.length}</p>
                <p><strong>Survey Analytics Total Calls:</strong> {surveyAnalytics.totalCalls}</p>
                <p><strong>Rating Data:</strong> {ratingData.length} items</p>
                <p><strong>Feedback Data:</strong> {feedbackData.length} items</p>
                <p><strong>Rating Details:</strong> {JSON.stringify(ratingData)}</p>
                <p><strong>Survey Analytics:</strong> {JSON.stringify(surveyAnalytics)}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Debug Section */}
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <h3 className="font-medium text-blue-900 mb-2">Data Debug Info:</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p><strong>Total Calls:</strong> {surveyAnalytics.totalCalls}</p>
                <p><strong>Average Rating:</strong> {surveyAnalytics.averageRating}</p>
                <p><strong>Satisfaction Rate:</strong> {surveyAnalytics.satisfactionRate}%</p>
                <p><strong>Response Rate:</strong> {surveyAnalytics.responseRate}%</p>
                <p><strong>Rating Data Items:</strong> {ratingData.length}</p>
                <p><strong>Feedback Data Items:</strong> {feedbackData.length}</p>
                <p><strong>Language Usage:</strong> {JSON.stringify(surveyAnalytics.languageUsage)}</p>
                <p><strong>Call Duration:</strong> {JSON.stringify(surveyAnalytics.callDuration)}</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-600 text-sm font-medium">Total Calls</p>
                    <p className="text-3xl font-bold text-blue-900">{surveyAnalytics.totalCalls}</p>
                  </div>
                  <Phone className="w-8 h-8 text-blue-500" />
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border border-green-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 text-sm font-medium">Average NPS</p>
                    <p className="text-3xl font-bold text-green-900">{surveyAnalytics.averageRating}/10</p>
                  </div>
                  <Star className="w-8 h-8 text-green-500" />
                </div>
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border border-purple-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-600 text-sm font-medium">Satisfaction Rate</p>
                    <p className="text-3xl font-bold text-purple-900">{surveyAnalytics.satisfactionRate}%</p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-purple-500" />
                </div>
              </div>

              <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-6 rounded-xl border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-orange-600 text-sm font-medium">Response Rate</p>
                    <p className="text-3xl font-bold text-orange-900">{surveyAnalytics.responseRate}%</p>
                  </div>
                  <MessageSquare className="w-8 h-8 text-orange-500" />
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* NPS Rating Chart */}
              <div className="bg-gray-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">NPS Rating Distribution (0-10)</h3>
                
                {/* Debug info for chart */}
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <p><strong>Chart Debug:</strong></p>
                  <p>Rating Data Length: {ratingData.length}</p>
                  <p>Filtered Data: {ratingData.filter(d => d.count > 0).length} items</p>
                  <p>Raw Rating Data: {JSON.stringify(ratingData)}</p>
                </div>
                
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ratingData.filter(d => d.count > 0)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="rating" 
                      tickFormatter={(value) => `${value}`}
                    />
                    <YAxis />
                    <Tooltip 
                      formatter={(value, name) => [value, 'Count']}
                      labelFormatter={(label) => `Rating: ${label}`}
                    />
                    <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Language Usage Chart */}
              <div className="bg-gray-50 p-6 rounded-xl">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Language Usage</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'English', value: surveyAnalytics.languageUsage.english },
                        { name: 'Hindi', value: surveyAnalytics.languageUsage.hindi },
                        { name: 'Both', value: surveyAnalytics.languageUsage.both }
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#3B82F6" />
                      <Cell fill="#10B981" />
                      <Cell fill="#F59E0B" />
                    </Pie>
                    <Tooltip formatter={(value, name) => [value, 'Calls']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Feedback Categories Chart */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Feedback by Category</h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={feedbackData.filter(d => d.total > 0)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any, name: string) => [value, name]}
                    content={({ active, payload, label }: any) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white p-3 border rounded-lg shadow-lg">
                            <p className="font-medium">{label}</p>
                            <p className="text-green-600">Positive: {data.positive}</p>
                            <p className="text-red-600">Negative: {data.negative}</p>
                            <p className="text-gray-600">Neutral: {data.neutral}</p>
                            <p className="text-blue-600">Total: {data.total}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend />
                  <Bar dataKey="positive" stackId="a" fill="#10B981" name="Positive" />
                  <Bar dataKey="negative" stackId="a" fill="#EF4444" name="Negative" />
                  <Bar dataKey="neutral" stackId="a" fill="#6B7280" name="Neutral" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Call Duration Chart */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Call Duration Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Short (<3 min)', value: surveyAnalytics.callDuration.short },
                      { name: 'Medium (3-5 min)', value: surveyAnalytics.callDuration.medium },
                      { name: 'Long (>5 min)', value: surveyAnalytics.callDuration.long }
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#EF4444" />
                    <Cell fill="#F59E0B" />
                    <Cell fill="#10B981" />
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, 'Calls']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* NPS Rating Breakdown */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">NPS Rating Breakdown</h3>
              <div className="space-y-3">
                {ratingData.filter(r => r.count > 0).map((rating) => (
                  <div key={rating.rating} className="flex items-center justify-between p-3 bg-white rounded-lg">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl font-bold text-blue-600">{rating.rating}</span>
                      <span className="font-medium text-gray-900">NPS Rating</span>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span className="text-gray-600">{rating.count} calls</span>
                      <span className="font-semibold text-gray-900">{rating.percentage}%</span>
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${rating.percentage}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Fallback display if no ratings with count > 0 */}
              {ratingData.filter(r => r.count > 0).length === 0 && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="font-medium text-red-900 mb-2">No Ratings Displayed - Debug Info:</h4>
                  <div className="text-sm text-red-800">
                    <p>All rating data: {JSON.stringify(ratingData)}</p>
                    <p>Ratings with count &gt; 0: {ratingData.filter(r => r.count > 0).length}</p>
                    <p>Total rating data length: {ratingData.length}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Feedback Summary */}
            <div className="bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Feedback Summary by Service</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {feedbackData.filter(d => d.total > 0).map((category) => (
                  <div key={category.category} className="bg-white p-4 rounded-lg border">
                    <h4 className="font-semibold text-gray-900 mb-3">{category.category}</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-green-600">Positive</span>
                        <span className="font-medium">{category.positive}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-red-600">Negative</span>
                        <span className="font-medium">{category.negative}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Neutral</span>
                        <span className="font-medium">{category.neutral}</span>
                      </div>
                      <div className="border-t pt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-900">Total</span>
                          <span className="font-bold text-blue-600">{category.total}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Survey Questions & Responses */}
            <div className="mt-8 bg-gray-50 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Survey Questions & Response Analysis</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="font-medium text-gray-900 mb-3">Survey Questions Asked</h4>
                  <ul className="text-sm text-gray-700 space-y-2">
                    <li>• Overall satisfaction with WEBSITES, SEO, SOCIAL MEDIA MANAGEMENT</li>
                    <li>• NPS score rating (0-10 scale)</li>
                    <li>• What customers liked most about the services</li>
                    <li>• Areas of improvement or challenges they faced</li>
                    <li>• Language preference (English/Hindi)</li>
                  </ul>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <h4 className="font-medium text-gray-900 mb-3">Response Insights</h4>
                  <div className="text-sm text-gray-700 space-y-2">
                    <p><span className="font-medium">Total Responses:</span> {surveyAnalytics.totalCalls}</p>
                    <p><span className="font-medium">Rating Responses:</span> {Math.round((surveyAnalytics.totalCalls * surveyAnalytics.responseRate) / 100)}</p>
                    <p><span className="font-medium">Language Mix:</span> {surveyAnalytics.languageUsage.english}E, {surveyAnalytics.languageUsage.hindi}H, {surveyAnalytics.languageUsage.both}B</p>
                    <p><span className="font-medium">Avg Call Duration:</span> {surveyAnalytics.callDuration.medium > 0 ? '3-5 min' : surveyAnalytics.callDuration.short > 0 ? '<3 min' : '>5 min'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Business Context */}
            <div className="mt-8 bg-blue-50 p-6 rounded-xl border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Business Context</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">About Our Business</h4>
                  <p className="text-sm text-blue-800">
                    WE CREATES WEBSITES FOR SMALL BUSINESSES AND STARTUPS HELP IN THEIR SEO, MANAGE CONTENT, MARKET THEM
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-blue-900 mb-2">Survey Agent</h4>
                  <p className="text-sm text-blue-800">
                    Feedback Assistant - A survey agent at AiServices collecting feedback on website, SEO, and social media management services
                  </p>
                </div>
              </div>
            </div>

            {/* Survey Guidelines */}
            <div className="mt-8 bg-green-50 p-6 rounded-xl border border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-4">Survey Guidelines & Agent Behavior</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-green-900 mb-2">Agent Characteristics</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Extremely friendly and understanding</li>
                    <li>• Starts sentences with conversational words</li>
                    <li>• Communicates in English and Hindi</li>
                    <li>• Professional but kind HR-like tone</li>
                    <li>• Keeps responses short and crisp</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-green-900 mb-2">Survey Flow</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>• Introduces as Feedback Assistant</li>
                    <li>• Asks if it's a good time to chat</li>
                    <li>• Collects NPS score (0-10)</li>
                    <li>• Gathers positive feedback</li>
                    <li>• Identifies improvement areas</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
