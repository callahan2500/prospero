// Function to generate chatbox HTML content
function getChatboxContent() {

    return `
      <div class="chat-interface">
          <div class="card">
              <div class="card-header p-3" style="border-bottom: 1px solid #ffa900;">
                  <h5 class="mb-0">Ask Lio a Question</h5>
              </div>
              <div class="card-body chat-messages" style="height: 200px; overflow-y: auto;">
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

      if (popoverTriggerEl.id ==='question-daemon'){
        popoverTriggerEl.addEventListener('shown.bs.popover', function(){
            loadChatMessages();
        })
      }

  
      // Initialize a new popover
      new bootstrap.Popover(popoverTriggerEl, {
        container: 'body',
        html: popoverTriggerEl.id === 'question-daemon', // Only allow HTML for question-daemon
        customClass: 'popover-body', // This is your custom class for targeting the popover
        sanitize: false,
        content: content
      });
      
    });
}

// Updated function to append messages to chat body inside popover
function appendMessageToChat(container, message, isUser) {
    var htmlMessage = marked.parse(message); // Convert Markdown to HTML
    var safeHtmlMessage = DOMPurify.sanitize(htmlMessage); // Sanitize the HTML content

    var messageBubble = document.createElement('div');
    messageBubble.classList.add('d-flex', isUser ? 'justify-content-end' : 'justify-content-start', 'chat-message');

    var messageContent = document.createElement('p');
    messageContent.classList.add('small', 'p-2', 'mb-3', 'rounded-3');
    // Set the background color based on whether the message is from the user or the assistant
    messageContent.style.backgroundColor = isUser ? '#dcf8c6' : '#f5f6f7';
    messageContent.innerHTML = safeHtmlMessage; // Use the sanitized HTML content

    var wrapperDiv = document.createElement('div'); // Extra wrapper for additional styling if needed
    wrapperDiv.appendChild(messageContent);
    
    messageBubble.appendChild(wrapperDiv);
    container.appendChild(messageBubble);
    container.scrollTop = container.scrollHeight; // Auto scroll to latest message
}

function loadChatMessages() {
    var chatContainer = document.querySelector('.chat-interface .chat-messages');
    if (chatContainer) {
        fetch('/get_messages')
        .then(response => response.json())
        .then(data => {
            chatContainer.innerHTML = ''; // Clear previous messages
            data.forEach(message => {
                appendMessageToChat(chatContainer, message.content, message.role === 'user');
            });
            chatContainer.scrollTop = chatContainer.scrollHeight;
        })
        .catch(error => {
            console.error('Error loading messages:', error);
        });
    }
}

// Call reinitializePopovers on DOMContentLoaded or when you need to set up the popovers
document.addEventListener('DOMContentLoaded', function () {
    reinitializePopovers();
});

document.body.addEventListener('click', function (event) {
    if (event.target.matches('.send-chat-message')) {
        var chatInput = event.target.closest('.chat-interface').querySelector('.chat-input');
        const projectTemplateId = document.getElementById('project-template-id').value; //Project Template ID

        var message = chatInput.value.trim();
        if (message) {
            // Sanitize the message
            var sanitizedMessage = DOMPurify.sanitize(message); 
            // Assuming 'projectId' is defined and accessible within the scope
            const projectId = document.getElementById('project-id').value; //Project ID
            
            fetch('/ask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_message: sanitizedMessage,
                    project_template_id: projectTemplateId
                }),
            })
            .then(response => response.json())
            .then(data => {
                // Append the user's message to the chat
                appendMessageToChat(chatInput.closest('.chat-interface').querySelector('.chat-messages'), sanitizedMessage, true);
            
                // Check if the response contains a message and append it
                if (data.message) {
                    appendMessageToChat(chatInput.closest('.chat-interface').querySelector('.chat-messages'), data.message, false);
                } else {
                    // Handle the case where there's an error in response
                    console.error('Lio is currently down, please try again later:', data.error);
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

