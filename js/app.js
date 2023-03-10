<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="author" content="Chris Webb, chris@arachsys.com">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>MIDI System Exclusive Tool</title>

  <script>
    async function midi(rxchooser, txchooser, receive) {
      let access, input, output;

      try {
        access = await navigator.requestMIDIAccess({sysex: true});
      } catch {
        return null;
      }

      rxchooser = rxchooser(function(id) {
        if (input && input.id != id && receive)
          input.removeEventListener("midimessage", receive);
        input = access.inputs.get(id);
        if (input && receive)
          input.addEventListener("midimessage", receive);
      });

      txchooser = txchooser(function(id) {
        output = access.outputs.get(id);
      });

      access.addEventListener("statechange", function(event) {
        const id = event.port.id, state = event.port.state;
        const name = state == "connected" ? event.port.name : null;
        if (event.port.type == "input")
          rxchooser(id, name);
        else if (event.port.type == "output")
          txchooser(id, name);
      });

      access.inputs.forEach(port => rxchooser(port.id, port.name));
      access.outputs.forEach(port => txchooser(port.id, port.name));
      return data => output && output.send(data);
    }

    function chooser(select) {
      select = document.getElementById(select);
      return function(choose) {
        select.onchange = event => choose(select.value);
        return function(id, name) {
          for (let option = 0; option < select.length; option++)
            if (select.options[option].value == id) {
              if (name) {
                if (select.options[option].text != name)
                  select.options[option].text = name;
                return;
              }
              select.options[option].remove(option);
            }
          if (name) {
            const option = document.createElement("option");
            option.value = id;
            option.text = name;
            select.add(option);
          }
          choose(select.value);
        };
      };
    }

    function shell(container, handler) {
      const input = document.createElement("input");
      const prompt = document.createElement("p");
      let history = [], buffer = [""], index = 0;

      function print(message, color) {
        const line = document.createElement("p");
        line.textContent = message;
        line.style.color = color;
        line.style.whiteSpace = "pre-wrap";
        container.insertBefore(line, prompt);
        prompt.scrollIntoView();
      };

      input.setAttribute("autofocus", "true");
      input.setAttribute("spellcheck", "false");
      input.style.margin = input.style.padding = 0;
      input.style.border = input.style.outline = 0;
      input.style.flex = 1;
      input.style.font = "inherit";

      prompt.innerHTML = "&gt;&nbsp;";
      prompt.style.display = "flex";
      prompt.appendChild(input);
      container.appendChild(prompt);

      input.addEventListener("keydown", event => {
        if (event.key == "Enter") {
          print("> " + input.value, null);
          if (input.value.trim()) {
            history.push(input.value);
            if (handler)
              handler(input.value);
          }
          input.value = "";
          buffer = history.concat([""]);
          index = history.length;
        } else if (event.key == "ArrowUp") {
          buffer[index] = input.value;
          if (index > 0)
            input.value = buffer[--index];
          event.preventDefault();
        } else if (event.key == "ArrowDown") {
          buffer[index] = input.value;
          if (index + 1 < buffer.length)
            input.value = buffer[++index];
          event.preventDefault();
        }
      });

      for (type of ["focus", "keypress", "paste"])
        window.addEventListener(type, event => input.focus());
      return print;
    }

    document.addEventListener("DOMContentLoaded", async function() {
      const log = document.getElementById("shell");
      const print = shell(log, send);
      const error = message => print(message, "red");
      const transmit = await midi(chooser("rx"), chooser("tx"), receive);

      function send(line) {
        const words = line.split(/\s+/).filter(Boolean);
        if (words[0] == "clear") {
          while (log.childNodes.length > 1)
            log.removeChild(log.firstChild);
          return;
        }

        const bytes = words.map(x => Number("0x" + x));
        if (bytes.some(x => isNaN(x) || x > 0xff))
          return error("Invalid byte sequence: " + line.trim());
        else if (bytes[0] & 0x80 == 0)
          return error("Commands must start with a status byte");
        else if (bytes[0] == 0xf0 && bytes[bytes.length - 1] != 0xf7)
          return error("System exclusive messages must end with f7");

        try {
          if (transmit && bytes.length > 0)
            transmit(bytes);
        } catch {
          error("Invalid MIDI command: " + line.trim());
        }
      }

      function receive(event) {
        const filter = document.getElementById("filter").value;
        if (filter != "exclusive" || event.data[0] == 0xf0)
          if (filter != "common" || event.data[0] < 0xf8)
            print(event.data.reduce(function(s, x) {
              return s + " " + x.toString(16).padStart(2, "0");
            }, "").slice(1), "green");
      }

      if (transmit == null)
        return error("Web MIDI not supported or port access refused");
      if (document.getElementById("rx").childNodes.length == 0)
        error("Warning: no MIDI inputs found");
      if (document.getElementById("tx").childNodes.length == 0)
        error("Warning: no MIDI outputs found");
    });
  </script>

  <style>
    html, body {
      height: 100%;
      margin: 0;
    }

    body {
      display: flex;
      flex-direction: column;
      overflow-y: hidden;
    }

    header {
      display: flex;
      border-bottom: 1px solid #ddd;
      padding: 4px;
      font-family: system-ui, sans-serif;
    }

    header > * {
      margin: 4px;
    }

    header #title {
      flex: 1;
      color: inherit;
      font-weight: bold;
      text-decoration: inherit;
    }

    header select:empty {
      visibility: hidden;
    }

    main {
      flex: 1;
      padding: 0 8px;
      font-family: monospace;
      overflow-y: auto;
    }
  </style>
</head>

<body>
  <header>
    <a href="https://arachsys.github.io/webmidi/" id="title">
      MIDI System Exclusive Tool
    </a>
    <select id="rx" title="MIDI Receive Port"></select>
    <select id="tx" title="MIDI Transmit Port"></select>
    <select id="filter" title="Display Filter">
      <option value="exclusive">System Exclusive</option>
      <option value="common">Channel &amp; Common</option>
      <option value="realtime">All Messages</option>
    </select>
  </header>
  <main id="shell"></main>
</body>
</html>