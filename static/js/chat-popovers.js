// Function to generate chatbox HTML content
function getChatboxContent() {
    var defaultLioMessage = `
    <div class="d-flex flex-row justify-content-start">
      <div>
        <p class="small p-2 ms-3 mb-3 rounded-3" style="background-color: #f5f6f7;">Hi, I'm happy to help!</p>
      </div>
    </div>
  `;
    return `
      <div class="chat-interface">
          <div class="card">
              <div class="card-header p-3" style="border-bottom: 1px solid #ffa900;">
                  <h5 class="mb-0">Ask Lio a Question</h5>
              </div>
              <div class="card-body chat-messages" style="height: 200px; overflow-y: auto;">
              ${defaultLioMessage} 
              </div>
              <div class="card-footer text-muted p-3">
                  <div class="input-group">
                      <input type="text" class="form-control chat-input" placeholder="Type a message..." aria-label="Message input"/>
                      <button class="btn btn-warning send-chat-message" type="button">Send</button>
                  </div>
              </div>
          </div>
      </div>
    `;
    
}

// Modify your reinitializePopovers function to include conditional content setting
function reinitializePopovers() {
    var popoverTriggerList = [].slice.call(document.querySelectorAll('.daemon[data-bs-toggle="popover"]'));
    popoverTriggerList.forEach(function (popoverTriggerEl) {
      // Disposing of any existing popovers
      var existingPopover = bootstrap.Popover.getInstance(popoverTriggerEl);
      if (existingPopover) {
        existingPopover.dispose();
      }
      
      // Check the ID to set content conditionally
      var content;
      if (popoverTriggerEl.id === 'question-daemon') {
        content = getChatboxContent(); // getChatboxContent for question-daemon
      } else {
        content = "Coming Soon!"; // Text for feedback and encouragement daemons
      }
  
      // Initialize a new popover
      new bootstrap.Popover(popoverTriggerEl, {
        container: 'body',
        html: popoverTriggerEl.id === 'question-daemon', // Only allow HTML for question-daemon
        sanitize: false,
        content: content
      });
    });
}

// Function to append messages to chat body inside popover
function appendMessageToChat(container, message, isUser) {
    var messageElement = document.createElement('div');
    messageElement.classList.add('d-flex', isUser ? 'justify-content-end' : 'justify-content-start');
    messageElement.innerHTML = `
        <div class="chat-message ${isUser ? 'user' : 'openai'}">
            ${DOMPurify.sanitize(message)}
        </div>
    `; // Apply necessary styling classes
    container.appendChild(messageElement);
    container.scrollTop = container.scrollHeight; // Auto scroll to latest message
}

// Call reinitializePopovers on DOMContentLoaded or when you need to set up the popovers
document.addEventListener('DOMContentLoaded', function () {
    reinitializePopovers();
});

document.body.addEventListener('click', function (event) {
    if (event.target.matches('.send-chat-message')) {
        var chatInput = event.target.closest('.chat-interface').querySelector('.chat-input');
        var message = chatInput.value.trim();
        if (message) {
            // Sanitize the message
            var sanitizedMessage = DOMPurify.sanitize(message); 
            // Assuming 'projectId' is defined and accessible within the scope
            const projectId = document.getElementById('project-id').value; //Project ID
            
            // Send the sanitized message to your Flask backend
            fetch('/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    question: sanitizedMessage,
                    project_template_id: projectId,
                }),
            })
            .then(response => response.json())
            .then(data => {
                // Append the user's message to the chat
                appendMessageToChat(chatInput.closest('.chat-interface').querySelector('.chat-messages'), sanitizedMessage, true);

                // Append OpenAI's response to the chat
                if(data.answer) {
                    appendMessageToChat(chatInput.closest('.chat-interface').querySelector('.chat-messages'), data.answer, false);
                } else {
                    // Handle any error or special messages like "I don't understand" as needed
                    console.error('Error or no answer received:', data.error || 'No answer');
                }
            })
            .catch(error => {
                // Handle fetch error
                console.error('Fetch error:', error);
            });

            // Clear the input field after sending the message
            chatInput.value = ''; 
        }
    }
});

