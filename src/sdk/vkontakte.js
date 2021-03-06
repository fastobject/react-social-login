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

  if (scope && parseInt(scope, 10) > 0) {
    vkontakteScopes += scope
  }

  const firstJS = document.getElementsByTagName('script')[0]
  const js = document.createElement('script')

  js.src = 'https://vk.com/js/api/openapi.js'
  js.id = 'vkontakte-jssdk'

  window.vkAsyncInit = () => {
    window.VK.init({
      apiId: appId
    })
  }

  if (!firstJS) {
    document.appendChild(js)
  } else {
    firstJS.parentNode.appendChild(js)
  }

  return resolve()
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
 * @see https://vk.com/dev/users.get
 */
const getProfile = () => new Promise((resolve) => {
  window.VK.Api.call('users.get',
    {user_ids: window.VK.Auth.getSession().user.id, fields: 'id,name,first_name,last_name,photo_200', v: apiVersion},
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
    expiresAt: timestampFromNow(response.expire),
    expire: response.expire,
    mid: response.mid,
    secret: response.secret,
    sid: response.sid,
    sig: response.sig
  }
})

export default {
  checkLogin,
  generateUser,
  load,
  login,
  logout
}
