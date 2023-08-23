
import {app} from './conf.js';
import { landing, about } from './landing.js';


export const RouteFlow = function () {
    this.loc = null;
    this.run = function (callback) {
        if (this.loc != location.hash) {
            setTimeout(function () {
                callback();
            },100)
            this.loc = location.hash;
        }
    }
}

export const routeFlow = new RouteFlow();

const run = function(){

    let newApp = new app();

    let router = new Router({
        mode: 'hash',
        page404: function (path) {
            console.log('"/' + path + '" Page not found');
        }
    });

    router.add('home', function () {
        routeFlow.run(function(){
            console.log('home');
            newApp.load(landing());
        })
    });

    router.add('hello/(:any)', function (name) {
        routeFlow.run(function () {
            console.log('hello')
            console.log('Hello, ' + name);
        });
    });

    router.add('about', function () {
        routeFlow.run(function () {
            console.log('about')
            newApp.load(about());
        })
    });

    router.addUriListener();

    if(location.hash == ''){
        router.navigateTo('/home');
    }else{
        var nv = location.hash.replace(/\#/g,"");
        location.hash = "/";
        router.navigateTo(nv);
    }
};

(function load(){
    if (typeof Router != 'undefined'){
        run();
    }else{
        setTimeout(function(){
            load();
        })
    }
})();
