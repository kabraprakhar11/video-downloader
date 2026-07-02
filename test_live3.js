const url = 'https://streamvault-backend-965260774860.us-central1.run.app/api/extract';
const testUrl = 'https://snapchat.com/t/mrbzlnqy';

fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: testUrl })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    console.log('SUCCESS!');
    console.log('Title:', data.data.title);
    console.log('Video URL:', data.data.formats[0].url.substring(0, 100) + '...');
  } else {
    console.log('FAILED:', data);
  }
})
.catch(err => console.error(err));
