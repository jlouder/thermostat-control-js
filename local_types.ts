interface HTMLDialogElement extends HTMLElement {
    open: Boolean;
    //returnValue: String;
    returnValue: string;
    show(): void;
    close(result?): void;
    showModal(): void;
}
