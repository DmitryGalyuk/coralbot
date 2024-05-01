export default class Spinner {
    static {
        this.div = document.createElement("dialog");
        this.div.className = "spinnerDialog";
        this.spinner = document.createElement("div");
        this.spinner.className = "spinnerAnimation";
        this.msg = document.createElement("div");
        this.msg.className = "spinnerMessage";

        this.div.appendChild(this.spinner);
        this.div.appendChild(this.msg);
        document.body.appendChild(this.div);

    }

    static show(message="") {
        this.msg.textContent = message;
        this.div.style.backgroundColor = window.getComputedStyle(document.body).backgroundColor;
        if (!this.div.open) {
            this.div.showModal();
        }
        return new Promise(r => requestAnimationFrame(r));
    }

    static close() {
        this.div.close();
    }
}