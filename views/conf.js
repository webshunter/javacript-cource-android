export const app = function () {
    this.appContainer = document.querySelector('#app');
    this.load = function(node){
        // clear
        this.appContainer.innerHTML = '';
        if(typeof node === 'object'){
            this.appContainer.appendChild(node);
        }
        return this;
    }
    return this;
}