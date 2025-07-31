document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("priceForm");
  const locationSelect = document.getElementById("location");
  const customLocationInput = document.getElementById("customLocation");
  const resultDiv = document.getElementById("result");

  locationSelect.addEventListener("change", () => {
    customLocationInput.classList.toggle("hidden", locationSelect.value !== "custom");
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const product = document.getElementById("product").value;
    const rawPrice = document.getElementById("price").value.replace(',', '.');
const price = parseFloat(rawPrice);
if (isNaN(price)) {
  alert("Inserisci un prezzo valido (es. 1,99 o 1,3)");
  return;
}
    let location = locationSelect.value;

    if (location === "geolocate") {
      try {
        const position = await getGeolocation();
        location = `lat: ${position.coords.latitude}, lon: ${position.coords.longitude}`;
      } catch (err) {
        alert("Geolocalizzazione non disponibile: " + err.message);
        return;
      }
    } else if (location === "custom") {
      location = customLocationInput.value || "non specificato";
    }

    try {
      const res = await fetch("/.netlify/functions/checkPrice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product, price, location }),
      });

      const data = await res.json();

      if (data.result) {
        const text = data.result.toLowerCase();
        let colorClass = "bg-blue-600"; // default: nella media

        if (text.includes("molto sopra la media")) {
          colorClass = "bg-red-600";
        } else if (text.includes("sopra la media")) {
          colorClass = "bg-yellow-600";
        } else if (text.includes("molto sotto la media")) {
          colorClass = "bg-green-600";
        } else if (text.includes("sotto la media")) {
          colorClass = "bg-green-600";
        }

        resultDiv.className = `mt-6 p-4 rounded text-white font-bold text-center ${colorClass}`;
        resultDiv.innerText = data.result;
        resultDiv.classList.remove("hidden");
      } else {
        resultDiv.className = "mt-6 p-4 rounded text-white font-bold text-center bg-red-600";
        resultDiv.innerText = "Errore nella risposta dell'intelligenza artificiale.";
        resultDiv.classList.remove("hidden");
      }
    } catch (error) {
      resultDiv.className = "mt-6 p-4 rounded text-white font-bold text-center bg-red-600";
      resultDiv.innerText = "Errore nella richiesta: " + error.message;
      resultDiv.classList.remove("hidden");
    }
  });

  function getGeolocation() {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject);
    });
  }
});