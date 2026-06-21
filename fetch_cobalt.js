fetch('https://instances.cobalt.tools/instances.json')
  .then(res => res.json())
  .then(data => {
     const instances = data.filter(i => i.cors === 1 && i.api_online && i.version.startsWith('10.'));
     console.log(instances.map(i => i.api).slice(0, 5));
  })
  .catch(console.error);
