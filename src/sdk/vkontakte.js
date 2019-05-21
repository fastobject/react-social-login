import Promise from 'bluebird'

import { rslError, timestampFromNow } from '../utils'

let vkontakteScopes = 4194304

const apiVersion = '5.95'
/**
 * Loads VKontakte SDK.
 * @param {string} appId
 * @param {array|string} scope
 * @see https://vk.com/dev/openapi
 */
const load = ({ appId, scope }) => new Promise((resolve) => {
  // @TODO: handle errors
  if (document.getElementById('vkontakte-jssdk')) {
    return resolve()
  }

  vkontakteScopes += scope

  const firstJS = document.getElementsByTagName('script')[0]
  const js = document.createElement('script')

  js.src = 'https://vk.com/js/api/openapi.js?160'
  js.id = 'vkontakte-jssdk'

  window.fbAsyncInit = () => {
    window.VK.init({
      apiId: appId
    })

    return resolve()
  }

  if (!firstJS) {
    document.appendChild(js)
  } else {
    firstJS.parentNode.appendChild(js)
  }
})

/**
 * Gets Vkontakte user profile if connected.
 * @param {Object} response
 */
const handleLoginStatus = (response) => new Promise((resolve, reject) => {
  if (!response.session) {
    return reject(rslError({
      provider: 'vkontakte',
      type: 'auth',
      description: 'Authentication failed',
      error: response
    }))
  }

  switch (response.status) {
    case 'connected':
      getProfile().then((profile) => resolve({
        ...profile,
        ...response.session
      }))

      break
    case 'not_authorized':
    case 'unknown':
      return reject(rslError({
        provider: 'vkontakte',
        type: 'auth',
        description: 'Authentication has been cancelled or an unknown error occurred',
        error: response
      }))
  }
})

/**
 * Checks if user is logged in to app through Vkontakte.
 * Requires SDK to be loaded first.
 * @see https://vk.com/dev/openapi?f=3.4.%20VK.Auth.getLoginStatus
 */
const checkLogin = () => new Promise((resolve, reject) => {
  window.VK.Auth.getLoginStatus((response) => handleLoginStatus(response)
    .then(resolve, reject))
})

/**
 * Trigger Vkontakte login popup.
 * Requires SDK to be loaded first.
 * @see https://vk.com/dev/openapi
 */
const login = () => new Promise((resolve, reject) => {
  window.VK.Auth.login((response) => handleLoginStatus(response)
    .then(resolve, reject), vkontakteScopes)
})

/**
 * Trigger Vkontakte logout.
 * Requires SDK to be loaded first.
 * @see https://vk.com/dev/openapi?f=3.2.%20VK.Auth.logout
 */
const logout = () => new Promise((resolve) => {
  window.VK.Auth.logout(resolve)
})

/**
 * Gets currently logged in user profile data.
 * Requires SDK to be loaded first.
 * @see https://developers.facebook.com/tools/explorer?method=GET&path=me%3Ffields%3Demail%2Cname%2Cid%2Cfirst_name%2Clast_name%2Cpicture&version=v2.9
 */
const getProfile = () => new Promise((resolve) => {
  window.VK.Api.call('users.get',
    {user_ids: window.VK.Auth.getSession().user.id, fields: 'id,name,first_name,last_name,photo_200,email', v: apiVersion},
    resolve)
})

/**
 * Helper to generate user account data.
 * @param {Object} response
 */
const generateUser = (response) => ({
  profile: {
    id: response.response[0].id,
    name: response.response[0].name,
    firstName: response.response[0].first_name,
    lastName: response.response[0].last_name,
    email: response.response[0].email,
    profilePicURL: response.response[0].photo_200
  },
  token: {
    accessToken: response.sid,
    expiresAt: timestampFromNow(response.expire)
  }
})

const oldLoad = (appId) => {
  const id = 'fb-client'
  const fjs = document.getElementsByTagName('script')[0]
  let js

  if (document.getElementById(id)) {
    return
  }

  js = document.createElement('script')

  js.id = id
  js.src = '//connect.facebook.net/en_US/all.js'

  js.onLoad = () => {
    window.fbAsyncInit = function () {
      window.FB.init({
        appId: appId,
        xfbml: true,
        version: 'v2.8'
      })
    }
  }

  fjs.parentNode.insertBefore(js, fjs)
}

export default {
  checkLogin,
  generateUser,
  load,
  login,
  logout,
  oldLoad
}
