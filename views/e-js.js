
const learn = function(){
    
    this.data = [];
    
    this add = function(data){
        this.data.push({
            title: data.title,
            id: data.id,
            content: el('div').html(html).get()
        });
    }
    
    this.get(){
        return this.data;
    }
    
}


const newJs = new learn();