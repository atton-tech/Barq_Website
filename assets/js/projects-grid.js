// Configuration
const HOVER_DELAY = 1000; // 1 second

// NEW: Client-side grouping logic
// This takes the "flat list" from n8n and organizes it into clients for the website
async function initPortfolio() {
    try {
        const response = await fetch('../portfolio-manifest.json');
        if (!response.ok) throw new Error('Failed to load manifest');
        
        const rawFiles = await response.json();
        const clientsMap = {};

        rawFiles.forEach(file => {
            const pathString = file.path || file;
            if (!pathString || typeof pathString !== 'string') return;

            const parts = pathString.split('/');
            if (parts.length < 5) return;

            // rawFolder is like "01_Nike" or "Adidas"
            const rawFolder = parts[3]; 
            const fileName = parts[4];
            const webPath = `../${pathString}`;

            if (!clientsMap[rawFolder]) {
                // 1. PARSE PRIORITY (Default is 999 if no number found)
                let priority = 999;
                let cleanName = rawFolder;

                // Check if name starts with number (e.g. "01_Name" or "1-Name")
                const match = rawFolder.match(/^(\d+)[_.-](.+)$/);
                if (match) {
                    priority = parseInt(match[1]); // Becomes 1
                    cleanName = match[2].replace(/_/g, ' '); // Becomes "Nike"
                }

                clientsMap[rawFolder] = {
                    id: rawFolder, // Unique ID
                    clientName: cleanName, // Display Name (No numbers)
                    priority: priority,    // Sorting Order
                    thumbnailSrc: '',
                    galleryImages: []
                };
            }

            if (fileName.toLowerCase().includes('thumbnail')) {
                clientsMap[rawFolder].thumbnailSrc = webPath;
            } else {
                clientsMap[rawFolder].galleryImages.push(webPath);
            }
        });

        // 2. CONVERT & SORT
        const projectsArray = Object.values(clientsMap);
        
        // Sort by Priority (Low numbers first), then by Name
        projectsArray.sort((a, b) => {
            if (a.priority === b.priority) {
                return a.clientName.localeCompare(b.clientName); // Tie-breaker: Alphabetical
            }
            return a.priority - b.priority;
        });

        // 3. SET THUMBNAILS
        projectsArray.forEach(client => {
            if (!client.thumbnailSrc && client.galleryImages.length > 0) {
                client.thumbnailSrc = client.galleryImages[0];
            }
        });

        // 4. RENDER
        renderProjects(projectsArray);
        if (typeof WOW === 'function') new WOW().init();

    } catch (error) {
        console.error('Error loading portfolio:', error);
    }
}

// Render Logic
function renderProjects(projects) {
    const gridContainer = document.getElementById('client-projects-grid');
    if (!gridContainer) return;

    gridContainer.innerHTML = ''; // Clear existing content

    projects.forEach((project, index) => {
        // Create Card wrapper
        const card = document.createElement('div');
        // Add wow animation classes
        card.className = 'client-card wow fadeInUp';
        // Add animation delay for staggered effect (0s, 0.1s, 0.2s...)
        card.setAttribute('data-wow-delay', `${index * 0.1}s`);
        card.setAttribute('data-id', project.id);

        // Thumbnail Image
        const thumbnail = document.createElement('img');
        thumbnail.src = project.thumbnailSrc;
        thumbnail.alt = `${project.clientName} Thumbnail`;
        thumbnail.className = 'card-thumbnail';

        // Client Name Overlay
        const nameOverlay = document.createElement('div');
        nameOverlay.className = 'client-name-overlay';
        const nameTitle = document.createElement('h3');
        nameTitle.textContent = project.clientName;
        nameOverlay.appendChild(nameTitle);

        // Assemble Card
        card.appendChild(thumbnail);
        card.appendChild(nameOverlay);

        // Attach Event Listeners
        attachHoverListeners(card, project); // Pass project data needed for the modal

        // Add to Grid
        gridContainer.appendChild(card);
    });
}

// Hover Intent Logic
function attachHoverListeners(card, projectData) {
    let hoverTimeout;

    card.addEventListener('mouseenter', () => {
        // Start delay timer
        hoverTimeout = setTimeout(() => {
            openModal(card, projectData);
        }, HOVER_DELAY);
    });

    card.addEventListener('mouseleave', () => {
        // Always clear the timeout first (if user leaves before 1s)
        clearTimeout(hoverTimeout);
        // Only cancel the OPENING action. 
        // We DO NOT close the modal on card mouseleave, because the modal is separate.
    });
}
// Global reference to current open modal to ensure only one exists
let currentModalOverlay = null;

function openModal(card, project) {
    // If a modal is already open, do not open another one
    if (currentModalOverlay) return;

    // Create Modal Overlay (Backdrop)
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'project-modal-overlay';
    currentModalOverlay = modalOverlay; // Track it globally
    
    // Create Modal Content
    const modalContent = document.createElement('div');
    modalContent.className = 'project-modal-content';

    // OPTIONAL: Add a header overlay with Client Name for context
    const headerOverlay = document.createElement('div');
    headerOverlay.className = 'modal-header-overlay';
    headerOverlay.innerHTML = `<h3>${project.clientName}</h3><span class="modal-hint">Scrolling Gallery</span>`;
    modalContent.appendChild(headerOverlay);

    // Marquee Track
    const marqueeTrack = document.createElement('div');
    marqueeTrack.className = 'marquee-track';
    
    // Populate Images for Infinite Scroll Logic
    // Include the thumbnail as the first image in the gallery
    let baseImages = [project.thumbnailSrc, ...project.galleryImages];
    
    // Padding: if fewer than 4 images, repeat the base set to fill space
    // For a 2-column grid we want an EVEN number of images in the base set
    // So that the "repeat" block starts on a new row cleanly.
    while(baseImages.length < 4 || baseImages.length % 2 !== 0) {
         baseImages = [...baseImages, ...baseImages]; // Duplicate the entire set to avoid adjacent duplicates
    }
    
    // Now create the double set for the seamless loop mechanics
    // The CSS animation moves -50% of the track height.
    // So the track must contain [One Full Sequence] + [One Full Sequence]
    const finalImages = [...baseImages, ...baseImages];
    
    finalImages.forEach(imgSrc => {
        const img = document.createElement('img');
        img.src = imgSrc;
        img.alt = `${project.clientName} Project`;
        img.className = 'marquee-image';
        marqueeTrack.appendChild(img);
    });

    modalContent.appendChild(marqueeTrack);
    modalOverlay.appendChild(modalContent);
    
    // Append to Body
    document.body.appendChild(modalOverlay);
    
    // Trigger animation
    // Use requestAnimationFrame to ensure the browser paints the initial state (opacity: 0) before adding active class
    requestAnimationFrame(() => {
        modalOverlay.classList.add('active');
    });

    // Interaction Logic:
    // 1. Close when mouse leaves the MODAL CONTENT (Desktop)
    modalContent.addEventListener('mouseleave', () => {
        closeModal();
    });

    // 2. Close when clicking the backdrop (Mobile/Desktop)
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });
}


function closeModal() {
    if (!currentModalOverlay) return;

    const modal = currentModalOverlay;
    modal.classList.remove('active');
    
    // Wait for transition to finish before removing from DOM
    setTimeout(() => {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }, 400); // Match CSS transition time

    currentModalOverlay = null;
}

// Initialize on DOM Load
document.addEventListener('DOMContentLoaded', () => {
    // Only run if the container exists
    if (document.getElementById('client-projects-grid')) {
        initPortfolio();
    }
});
