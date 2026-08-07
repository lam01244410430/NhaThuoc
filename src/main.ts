import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import Router from './router/index'
import { createBootstrap } from 'bootstrap-vue-next'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/css/bootstrap.css'
import 'bootstrap-vue-next/dist/bootstrap-vue-next.css'

import { library } from '@fortawesome/fontawesome-svg-core'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import { 
  faCircleUser, faCartShopping, faPhone, faEnvelope, 
  faMagnifyingGlass, faBars, faChevronRight 
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

library.add(faCircleUser, faCartShopping, faPhone, faEnvelope, faMagnifyingGlass, faBars, faChevronRight, faArrowRight)

const pinia = createPinia()
const app = createApp(App)

app.component('font-awesome-icon', FontAwesomeIcon)

app.use(pinia)
app.use(Router)
app.use(createBootstrap())

app.mount('#app')