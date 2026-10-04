const prices = {
    "50": 45,
    "100": 75,
};

const shippingFees = {
    "Recojo en Lima": 0,
    "Envio Lima": 10,
    "Envio provincias": 15,
};

const WHATSAPP_NUMBER = "51929445834"; // Reemplaza con el número oficial de ventas

const orderForm = document.getElementById("order-form");
const presentationField = document.getElementById("presentation");
const quantityField = document.getElementById("quantity");
const deliveryField = document.getElementById("delivery");
const totalLabel = document.getElementById("order-total");
const currentYear = document.getElementById("current-year");

function formatCurrency(amount) {
    return `S/ ${amount.toFixed(2)}`;
}

function calculateTotal() {
    const presentation = presentationField.value;
    const quantity = Number(quantityField.value) || 0;
    const delivery = deliveryField.value;

    if (!presentation || quantity <= 0) {
        totalLabel.textContent = "S/ 0.00";
        return;
    }

    const baseTotal = prices[presentation] * quantity;
    const shipping = delivery ? shippingFees[delivery] || 0 : 0;
    const total = baseTotal + shipping;

    totalLabel.textContent = formatCurrency(total);
}

function buildMessage(formData) {
    const presentation = formData.get("presentation");
    const presentationText = presentation === "50" ? "50 ml" : "100 ml";
    const quantity = formData.get("quantity");
    const delivery = formData.get("delivery");
    const notes = formData.get("notes")?.trim();
    const total = totalLabel.textContent;

    const messageLines = [
  " *¡Hola! Quiero hacer un pedido de QUIMIVER:*",
  ` *Cliente:* ${formData.get("customer-name")}`,
  ` *Celular:* ${formData.get("phone")}`,
  ` *Ciudad:* ${formData.get("city")}`,
  ` *Presentación:* ${presentationText}`,
  ` *Cantidad:* ${quantity}`,
  ` *Entrega:* ${delivery}`,
  ` *Total estimado:* ${total}`,
  "",
  " *Métodos de pago:*",
  " Yape / Plin: *929445834*",
  "",
  " Por favor envíe el comprobante de pago para procesar su pedido. ¡Gracias por confiar en *QUIMIVER*! "
];

    if (notes) {
        messageLines.push(`• Observaciones: ${notes}`);
    }

    return encodeURIComponent(messageLines.join("\n"));
}

function redirectToWhatsApp(message) {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    const newWindow = window.open(url, "_blank");

    if (!newWindow) {
        alert("Activa las ventanas emergentes para enviar tu pedido por WhatsApp.");
    }
}

if (orderForm) {
    ["change", "input"].forEach((eventName) => {
        presentationField.addEventListener(eventName, calculateTotal);
        quantityField.addEventListener(eventName, calculateTotal);
        deliveryField.addEventListener(eventName, calculateTotal);
    });

    orderForm.addEventListener("submit", (event) => {
        event.preventDefault();
        if (!orderForm.reportValidity()) {
            return;
        }

        const formData = new FormData(orderForm);
        const message = buildMessage(formData);

        redirectToWhatsApp(message);
        orderForm.reset();
        calculateTotal();
    });
}

if (currentYear) {
    currentYear.textContent = new Date().getFullYear();
}

calculateTotal();
