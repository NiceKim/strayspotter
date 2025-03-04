///////////////////////////////////////////////////////////////////////////////////
// FUNCTIONS AND VARIABLES
///////////////////////////////////////////////////////////////////////////////////

const galleryGrid = document.getElementById('galleryGrid');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const MAX_KEYS_TO_BE_SENT = 100;

/**
 * Generates an HTML string for a gallery item (image card)
 * 
 * @param {Object} src - The source object containing the image URL and optional metadata.
 * @returns {string} The HTML string representing the gallery item.
 */
function createGalleryItem(src) {
    return `
        <div class="card">
            <div class="card-content">
                <img src="${src}" alt="Cat Image">
            </div>
        </div>
    `;
}

/**
 * Fetches images from the server and updates the gallery.
 * 
 * @param {number} maxKeys - The maximum number of image keys to fetch.
 */
async function loadImages(maxKeys) {

  const response = await fetch(`/images?maxKeys=${maxKeys}`);
  if (!response.ok) {
    console.error('Failed to fetch images:', response.statusText);
    return;
  }

  const imageKeys = await response.json();
  imageKeys.forEach(async (key) => {
    const urlResponse = await fetch(`/image-url?key=${key}`);
    if (urlResponse.ok) {
        urlResponse.json().then( data => {
            console.log(data);
            galleryGrid.innerHTML += createGalleryItem(data.url);
        })
    } else {
        console.error('Failed to fetch pre-signed URL:', urlResponse.statusText);
    }
  });
}

///////////////////////////////////////////////////////////////////////////////////
// CODE EXECUTION AND EVENT LISTNERS
///////////////////////////////////////////////////////////////////////////////////

loadImages(MAX_KEYS_TO_BE_SENT);

/**
 * TODO: Implement the functions to Load more images
 */
loadMoreBtn.addEventListener('click', () => {
    alert('Load more images functionality would be implemented here.');
});