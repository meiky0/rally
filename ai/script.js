import { Conversation } from '@elevenlabs/client';

// DOM Elements
const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const connectionStatus = document.getElementById('connectionStatus');
const agentStatus = document.getElementById('agentStatus');
const statusIndicator = document.getElementById('statusIndicator');
const phoneNumber = document.getElementById('phoneNumber');
const knowledgeText = document.getElementById('knowledgeText');
const saveButton = document.getElementById('saveButton');
const callButton = document.getElementById('callButton');
const configStatus = document.getElementById('configStatus');
const transcriptionDisplay = document.getElementById('transcriptionDisplay');

// Global variables
let conversation = null;
let isTranscribing = false;

// Configuration management
let config = {
    phoneNumber: '',
    knowledgeText: '',
    saved: false
};

// Load saved configuration from localStorage
function loadConfiguration() {
    const saved = localStorage.getItem('aiConfig');
    if (saved) {
        try {
            config = JSON.parse(saved);
            phoneNumber.value = config.phoneNumber || '';
            knowledgeText.value = config.knowledgeText || '';
            updateConfigStatus();
        } catch (error) {
            console.error('Error loading configuration:', error);
        }
    }
}

// Save configuration to localStorage
function saveConfiguration() {
    config = {
        phoneNumber: phoneNumber.value.trim(),
        knowledgeText: knowledgeText.value.trim(),
        saved: true,
        savedAt: new Date().toLocaleString()
    };
    
    try {
        localStorage.setItem('aiConfig', JSON.stringify(config));
        updateConfigStatus();
        addTranscriptionEntry('System', 'Configuration saved successfully');
    } catch (error) {
        console.error('Error saving configuration:', error);
        addTranscriptionEntry('System', 'Error saving configuration');
    }
}

// Update configuration status display
function updateConfigStatus() {
    if (config.saved) {
        configStatus.innerHTML = `
            <strong>Configuration saved</strong><br>
            Phone: ${config.phoneNumber || 'Not set'}<br>
            Knowledge: ${config.knowledgeText ? 'Set (' + config.knowledgeText.length + ' chars)' : 'Not set'}<br>
            <small>Saved: ${config.savedAt}</small>
        `;
        configStatus.style.color = '#4CAF50';
    } else {
        configStatus.textContent = 'No configuration saved';
        configStatus.style.color = '#666';
    }
}

// Update status indicator
function updateStatusIndicator(status) {
    statusIndicator.innerHTML = '';
    const indicator = document.createElement('span');
    indicator.className = status === 'speaking' ? 'listening-indicator speaking-indicator' : 'listening-indicator';
    statusIndicator.appendChild(indicator);
}

// Add transcription entry with proper formatting
function addTranscriptionEntry(speaker, message, timestamp = new Date()) {
    const entry = document.createElement('div');
    entry.className = 'transcript-entry';
    
    let speakerClass = 'system-message';
    if (speaker.toLowerCase() === 'user') {
        speakerClass = 'user-message';
    } else if (speaker.toLowerCase() === 'ai') {
        speakerClass = 'ai-message';
    }
    
    const timeStr = timestamp.toLocaleTimeString();
    
    entry.innerHTML = `
        <span class="speaker-label ${speakerClass}">${speaker}:</span>
        <span class="timestamp">${timeStr}</span><br>
        ${message}
    `;
    
    // Clear placeholder text if it exists
    const placeholder = transcriptionDisplay.querySelector('.system-message');
    if (placeholder && placeholder.textContent.includes('Conversation transcription will appear here')) {
        transcriptionDisplay.innerHTML = '';
    }
    
    transcriptionDisplay.appendChild(entry);
    transcriptionDisplay.scrollTop = transcriptionDisplay.scrollHeight;
    
    console.log(`[${timeStr}] ${speaker}: ${message}`);
}

// Clear transcription display
function clearTranscription() {
    transcriptionDisplay.innerHTML = '<div class="system-message">Conversation transcription will appear here...</div>';
}

// Start conversation with ElevenLabs
async function startConversation() {
    try {
        addTranscriptionEntry('System', 'Requesting microphone permission...');
        
        // Request microphone permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            } 
        });
        
        addTranscriptionEntry('System', 'Microphone access granted');
        addTranscriptionEntry('System', 'Connecting to ElevenLabs agent...');

        // Prepare conversation options
        const conversationOptions = {
            agentId: 'agent_01jwm20k96f1as3qhtcbp2zc7a',
            
            // Connection callbacks
            onConnect: () => {
                console.log('Connected to ElevenLabs agent');
                connectionStatus.textContent = 'Connected';
                connectionStatus.style.color = '#4CAF50';
                startButton.disabled = true;
                stopButton.disabled = false;
                isTranscribing = true;
                updateStatusIndicator('listening');
                addTranscriptionEntry('System', 'Successfully connected to AI agent');
            },
            
            onDisconnect: () => {
                console.log('Disconnected from ElevenLabs agent');
                connectionStatus.textContent = 'Disconnected';
                connectionStatus.style.color = '#666';
                startButton.disabled = false;
                stopButton.disabled = true;
                isTranscribing = false;
                statusIndicator.innerHTML = '';
                addTranscriptionEntry('System', 'Disconnected from AI agent');
            },
            
            onError: (error) => {
                console.error('ElevenLabs Conversation Error:', error);
                const errorMessage = error.message || error.toString() || 'Unknown connection error';
                addTranscriptionEntry('System', `Error: ${errorMessage}`);
                
                // Reset UI state
                connectionStatus.textContent = 'Error';
                connectionStatus.style.color = '#f44336';
                startButton.disabled = false;
                stopButton.disabled = true;
                isTranscribing = false;
                statusIndicator.innerHTML = '';
            },
            
            // Mode change callback
            onModeChange: (mode) => {
                const modeText = mode.mode || mode;
                console.log('Mode changed to:', modeText);
                agentStatus.textContent = modeText;
                updateStatusIndicator(modeText);
                
                if (modeText === 'speaking') {
                    addTranscriptionEntry('System', 'AI is speaking...');
                } else if (modeText === 'listening') {
                    addTranscriptionEntry('System', 'AI is listening...');
                }
            },
            
            // User speech transcription
            onUserTranscript: (transcript) => {
                console.log('User transcript:', transcript);
                if (transcript && transcript.text) {
                    addTranscriptionEntry('User', transcript.text);
                } else if (typeof transcript === 'string') {
                    addTranscriptionEntry('User', transcript);
                }
            },
            
            // Agent response
            onAgentResponse: (response) => {
                console.log('Agent response:', response);
                if (response && response.text) {
                    addTranscriptionEntry('AI', response.text);
                } else if (typeof response === 'string') {
                    addTranscriptionEntry('AI', response);
                }
            },
            
            // Generic message handler
            onMessage: (message) => {
                console.log('Received message:', message);
                
                if (!message) return;
                
                // Handle different message types
                if (message.type === 'user_transcript' || message.type === 'user_message') {
                    const text = message.text || message.content || message.message;
                    if (text) {
                        addTranscriptionEntry('User', text);
                    }
                } else if (message.type === 'agent_response' || message.type === 'agent_message') {
                    const text = message.text || message.content || message.message;
                    if (text) {
                        addTranscriptionEntry('AI', text);
                    }
                } else if (message.type === 'conversation_start') {
                    addTranscriptionEntry('System', 'Conversation started');
                } else if (message.type === 'conversation_end') {
                    addTranscriptionEntry('System', 'Conversation ended');
                }
            },
            
            // Audio callbacks
            onUserAudioStart: () => {
                console.log('User started speaking');
                addTranscriptionEntry('System', 'User audio detected');
            },
            
            onUserAudioEnd: () => {
                console.log('User stopped speaking');
            },
            
            onAgentAudioStart: () => {
                console.log('Agent started speaking');
            },
            
            onAgentAudioEnd: () => {
                console.log('Agent stopped speaking');
            }
        };
        
        // Add knowledge text as system prompt if available
        if (config.knowledgeText && config.knowledgeText.trim()) {
            conversationOptions.systemPrompt = config.knowledgeText.trim();
            addTranscriptionEntry('System', `Using knowledge base (${config.knowledgeText.length} characters)`);
        }

        // Start the conversation
        conversation = await Conversation.startSession(conversationOptions);
        
        console.log('Conversation session started:', conversation);

    } catch (error) {
        console.error('Failed to start conversation:', error);
        const errorMessage = error.message || error.toString() || 'Failed to initialize conversation';
        addTranscriptionEntry('System', `Startup failed: ${errorMessage}`);
        
        // Reset UI state
        connectionStatus.textContent = 'Failed';
        connectionStatus.style.color = '#f44336';
        startButton.disabled = false;
        stopButton.disabled = true;
        isTranscribing = false;
        statusIndicator.innerHTML = '';
    }
}

// Stop conversation
async function stopConversation() {
    try {
        addTranscriptionEntry('System', 'Stopping conversation...');
        
        if (conversation) {
            await conversation.endSession();
            conversation = null;
        }
        
        // Reset UI state
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.style.color = '#666';
        startButton.disabled = false;
        stopButton.disabled = true;
        isTranscribing = false;
        agentStatus.textContent = 'listening';
        statusIndicator.innerHTML = '';
        
        addTranscriptionEntry('System', 'Conversation stopped successfully');
        
    } catch (error) {
        console.error('Error stopping conversation:', error);
        addTranscriptionEntry('System', `Error stopping: ${error.message || 'Unknown error'}`);
        
        // Force reset UI state
        connectionStatus.textContent = 'Disconnected';
        connectionStatus.style.color = '#666';
        startButton.disabled = false;
        stopButton.disabled = true;
        isTranscribing = false;
        agentStatus.textContent = 'listening';
        statusIndicator.innerHTML = '';
        conversation = null;
    }
}

// Make phone call (placeholder for future implementation)
function makeCall() {
    if (!config.phoneNumber || !config.phoneNumber.trim()) {
        alert('Please enter and save a phone number first.');
        phoneNumber.focus();
        return;
    }
    
    addTranscriptionEntry('System', `Call request: ${config.phoneNumber}`);
    
    console.log('Phone call requested:', {
        phoneNumber: config.phoneNumber,
        knowledgeText: config.knowledgeText,
        hasKnowledge: !!config.knowledgeText
    });
    
    const message = `Phone call functionality:\n\n` +
                   `• Target: ${config.phoneNumber}\n` +
                   `• Knowledge Base: ${config.knowledgeText ? 'Configured (' + config.knowledgeText.length + ' chars)' : 'Not configured'}\n\n` +
                   `This requires integration with ElevenLabs telephony API or similar service.`;
    
    alert(message);
}

// Phone number input validation
function validatePhoneInput(event) {
    // Allow only numbers, spaces, dashes, parentheses, and plus sign
    const cleaned = event.target.value.replace(/[^\d\s\-\(\)+]/g, '');
    if (cleaned !== event.target.value) {
        event.target.value = cleaned;
    }
}

// Event listeners
startButton.addEventListener('click', startConversation);
stopButton.addEventListener('click', stopConversation);
saveButton.addEventListener('click', saveConfiguration);
callButton.addEventListener('click', makeCall);
phoneNumber.addEventListener('input', validatePhoneInput);

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
    // Ctrl+Enter or Cmd+Enter to start/stop conversation
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        if (startButton.disabled) {
            stopConversation();
        } else {
            startConversation();
        }
    }
    
    // Ctrl+S or Cmd+S to save configuration
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        saveConfiguration();
    }
});

// Initialize application
function initializeApp() {
    console.log('Initializing OS1 Application...');
    
    // Load saved configuration
    loadConfiguration();
    
    // Clear any existing transcription
    clearTranscription();
    
    // Add welcome message
    addTranscriptionEntry('System', 'OS1 Application initialized');
    
    console.log('OS1 Application ready');
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Export functions for debugging (optional)
window.OS1Debug = {
    addTranscription: addTranscriptionEntry,
    clearTranscription: clearTranscription,
    getConfig: () => config,
    getConversation: () => conversation
};