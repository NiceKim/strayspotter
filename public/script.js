const imageContainer = document.getElementById('imageContainer');
const fileInput = document.getElementById('imageInput');
const MAX_KEYS_TO_BE_SENT = 4;

      
document.getElementById('uploadForm').addEventListener('submit', async (event) => {
  console.log(event);
  event.preventDefault();

  const formData = new FormData();
  // const filenameInput = document.querySelector('input[name="filename"]'); - Deprecated only for handling file names inputted by the user
  formData.append('image', fileInput.files[0]);
  // formData.append('filename', filenameInput.value);

  const response = await fetch('/upload', {
  method: 'POST',
  body: formData,
  });

  if (response.ok) {
  fetchImages(MAX_KEYS_TO_BE_SENT); // Refresh the image list after upload
  } else {
  console.error('Upload failed:', response.statusText);
  }
});

async function fetchImages(maxKeys) {
    const response = await fetch(`/images?maxKeys=${maxKeys}`);

    if (!response.ok) {
      console.error('Failed to fetch images:', response.statusText);
      return;
    }

    const imageKeys = await response.json();

    imageContainer.innerHTML = ''; // Clear existing images

    imageKeys.forEach(async (key) => {
      // Fetch the pre-signed URL for the image
      const urlResponse = await fetch(`/image-url?key=${key}`);
      if (urlResponse.ok) {

        urlResponse.json().then( data => {
          console.log(data);
           // Create an image element and set its source to the pre-signed URL
          const img = document.createElement('img');
          img.src = data.url; // Set the source to the pre-signed URL
          img.alt = 'Image';
          img.style.maxWidth = '200px';
          img.style.margin = '10px';

          // Append the image to the container
          imageContainer.appendChild(img);
       })

      } else {
        console.error('Failed to fetch pre-signed URL:', urlResponse.statusText);
      }

    });
  }

  
fetchImages(MAX_KEYS_TO_BE_SENT);


