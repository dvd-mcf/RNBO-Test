function onEnabled() {

  if (WebMidi.inputs.length < 1) {
    document.body.innerHTML+= "No device detected.";
  } else {
    WebMidi.inputs.forEach((device, index) => {
      document.body.innerHTML+= `${index}: ${device.name} <br>`;
    });
  }
  
  const mySynth = WebMidi.inputs[0];
  // const mySynth = WebMidi.getInputByName("TYPE NAME HERE!")
  
  mySynth.channels[1].addListener("noteon", e => {
    document.body.innerHTML+= `${e.note.name} <br>`;
  });
  
}