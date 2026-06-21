const url = "https://streamvault-backend-965260774860.us-central1.run.app/api/extract";
fetch(url, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ url: "https://www.youtube.com/watch?v=jNQXAC9IVRw" })
})
.then(res => res.json().then(data => ({status: res.status, data})))
.then(console.log)
.catch(console.error);
