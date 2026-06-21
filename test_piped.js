fetch('https://pipedapi.kavin.rocks/streams/jNQXAC9IVRw')
  .then(res => res.json())
  .then(data => {
     if (data.error) console.error(data.error);
     else console.log(data.videoStreams.length, 'video streams found');
  })
  .catch(console.error);
