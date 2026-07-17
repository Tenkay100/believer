export function initSupportWidget() {
  if (document.getElementById('support-widget')) return;

  const widgetHtml = `
    <div id="support-widget" style="position: fixed; bottom: 24px; right: 24px; z-index: 9999; font-family: var(--font-family, sans-serif);">
      <div id="support-chat-window" class="animate-scale-in" style="display: none; width: 320px; height: 450px; background: var(--bg-800); border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.5); flex-direction: column; overflow: hidden; margin-bottom: 16px; position: absolute; bottom: 60px; right: 0;">
        <div id="support-chat-header" style="background: linear-gradient(135deg, var(--primary), var(--accent)); color: white; padding: 20px; display: flex; justify-content: space-between; align-items: center; cursor: grab;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 10px; height: 10px; background: #10b981; border-radius: 50%; box-shadow: 0 0 8px #10b981;"></div>
            <span style="font-weight: bold; font-size: 1.1rem; pointer-events: none;">Live Support</span>
          </div>
          <i class="ph-bold ph-x" id="support-close" style="cursor: pointer; font-size: 1.2rem;"></i>
        </div>
        <div id="support-messages" style="flex: 1; padding: 20px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: var(--bg-900);">
          <div style="background: var(--bg-700); padding: 12px 16px; border-radius: 12px 12px 12px 0; font-size: 0.9rem; align-self: flex-start; max-width: 85%; color: var(--text-100); border: 1px solid var(--border);">
            Hello! Welcome to American First Financial support. How can we assist you today?
          </div>
        </div>
        <div style="padding: 16px; background: var(--bg-800); border-top: 1px solid var(--border); display: flex; gap: 10px; align-items: center;">
          <input type="text" id="support-input" placeholder="Type your message..." style="flex: 1; background: var(--bg-900); border: 1px solid var(--border); color: white; border-radius: 24px; padding: 10px 16px; font-size: 0.9rem; outline: none; transition: all 0.2s;">
          <button id="support-send" style="background: var(--primary); color: white; border: none; border-radius: 50%; width: 40px; height: 40px; display: flex; justify-content: center; align-items: center; cursor: pointer; transition: transform 0.2s;">
            <i class="ph-bold ph-paper-plane-tilt" style="font-size: 1.1rem;"></i>
          </button>
        </div>
      </div>
      <button id="support-toggle" style="width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--accent)); color: white; border: none; box-shadow: 0 8px 24px rgba(26,86,219,0.4); display: flex; justify-content: center; align-items: center; cursor: pointer; float: right; transition: transform 0.2s;">
        <i class="ph-fill ph-chat-circle-dots" style="font-size: 2rem;"></i>
      </button>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', widgetHtml);

  const toggleBtn = document.getElementById('support-toggle');
  const closeBtn = document.getElementById('support-close');
  const chatWindow = document.getElementById('support-chat-window');
  const sendBtn = document.getElementById('support-send');
  const input = document.getElementById('support-input');
  const msgs = document.getElementById('support-messages');

  toggleBtn.addEventListener('click', () => {
    chatWindow.style.display = chatWindow.style.display === 'none' ? 'flex' : 'none';
  });

  closeBtn.addEventListener('click', () => {
    chatWindow.style.display = 'none';
  });

  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
  });

  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;
    
    msgs.innerHTML += `
      <div class="animate-fade-in" style="background: var(--primary); color: white; padding: 12px 16px; border-radius: 12px 12px 0 12px; font-size: 0.9rem; align-self: flex-end; max-width: 85%;">
        ${text}
      </div>
    `;
    input.value = '';
    msgs.scrollTop = msgs.scrollHeight;

    setTimeout(() => {
      msgs.innerHTML += `
        <div class="animate-fade-in" style="background: var(--bg-700); padding: 12px 16px; border-radius: 12px 12px 12px 0; font-size: 0.9rem; align-self: flex-start; max-width: 85%; color: var(--text-100); border: 1px solid var(--border);">
          Thank you for reaching out. A support agent will review your request and connect with you shortly.
        </div>
      `;
      msgs.scrollTop = msgs.scrollHeight;
    }, 1500);
  }

  // Make chat window draggable
  const header = document.getElementById('support-chat-header');
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;
  let xOffset = 0;
  let yOffset = 0;

  header.addEventListener('mousedown', dragStart);
  document.addEventListener('mouseup', dragEnd);
  document.addEventListener('mousemove', drag);

  function dragStart(e) {
    if (e.target === closeBtn) return;
    initialX = e.clientX - xOffset;
    initialY = e.clientY - yOffset;
    isDragging = true;
    header.style.cursor = 'grabbing';
  }

  function dragEnd(e) {
    initialX = currentX;
    initialY = currentY;
    isDragging = false;
    header.style.cursor = 'grab';
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();
      currentX = e.clientX - initialX;
      currentY = e.clientY - initialY;
      xOffset = currentX;
      yOffset = currentY;
      setTranslate(currentX, currentY, chatWindow);
    }
  }

  function setTranslate(xPos, yPos, el) {
    el.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;
  }
}
