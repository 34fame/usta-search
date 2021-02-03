const axios = require('axios')
const nodemailer = require('nodemailer')
const HTMLParser = require('node-html-parser')

const transporter = nodemailer.createTransport({
   service: 'gmail',
   auth: {
      user: 'troy@morelands.net',
      pass: 'usrrunlnjblselur',
   },
})

const getMailOptions = (props) => {
   const {
      from = 'troy@morelands.net',
      to = 'troy@morelands.net, tristan@morelands.net, shanamoreland@yahoo.com',
      subject = 'USTA Tournament Search Results',
      text,
      html,
   } = props
   return { from, to, subject, text, html }
}

const sendEmail = async (options) => {
   transporter.sendMail(options, function (error, info) {
      if (error) {
         console.log(error)
      } else {
         console.log('Email sent: ' + info.response)
      }
   })
}

const generateUrl = (props) => {
   console.group('generateUrl')
   console.log('Starting to generate the search URL...')
   const {
      Action = '2',
      Year = '2021',
      Zip = '77433',
      Sanctioned = '0',
      AgeGroup = 'Y',
      QuickSearch = '7',
      SectionDistrict = '8096',
      Division = 'D1007',
      Month = '2',
      SearchRadius = '50',
      Intermediate = 'True',
   } = props
   console.log(`Based on ${props}...`)
   const baseUrl = 'https://tennislink.usta.com/Tournaments/Schedule/SearchResults.aspx'
   const params = new URLSearchParams({
      Action,
      Year,
      Zip,
      Sanctioned,
      AgeGroup,
      QuickSearch,
      SectionDistrict,
      Division,
      Month,
      SearchRadius,
      Intermediate,
   })
   const searchUrl = `${baseUrl}/?${params.toString()}`
   console.log(`We are going to search the url ${searchUrl}`)
   return searchUrl
}

const search = async (url) => {
   console.group('search')
   console.log('Starting search...')
   try {
      const result = await axios.get(url, {
         headers: {
            Accept: 'text/html',
         },
      })
      console.log(`HTTP status was ${result.status}...`)
      if (result.status !== 200) return false
      let root = result.data
      console.log(`Size of data returned was ${root.length}...`)
      root = HTMLParser.parse(root)
      const resultsTable = root.querySelector('#ctl00_mainContent_dgTournaments')
      if (!resultsTable) {
         console.log(`No results for tournaments table found...`)
         return false
      }
      console.log(`Size of tournament table HTML returned was ${resultsTable.length}...`)
      const rows = resultsTable.querySelectorAll('tr')

      let tournaments = []
      rows.map((r, idx) => {
         //Skip the first row of headers
         if (idx === 0) return false

         const cols = r.querySelectorAll('td')

         let tournament = {}
         cols.map((c, idx) => {
            // Remove all extra whitespace (data is full of it)
            c = c.removeWhitespace()

            // Return tournament date
            if (idx === 0) tournament.date = c.text

            // Return tournament name and ID
            if (idx === 1) {
               let _a = c.firstChild
               _a = _a.removeWhitespace()
               let name = _a.text
               name = name.replace(/\r\n/g, '')
               name = name.replace(/\s\s/g, '')
               let nameParts = name.split('-')
               tournament.name = nameParts[0]
               tournament.id = nameParts[1]
            }

            // Return registration link
            if (idx === 4) {
               const links = c.querySelectorAll('a')
               links.map((l) => {
                  if (l.text === 'Register Online')
                     tournament.registration = `https://tennislink.usta.com${l.getAttribute('href')}`
               })
            }
            if (!tournament.registration) return false
         })
         tournaments.push(tournament)
      })
      console.log('tournaments', tournaments)
      return tournaments
   } catch (err) {
      console.error('search', err)
      return false
   } finally {
      console.groupEnd()
   }
}

const searchTournaments = async () => {
   let url = generateUrl({})

   const tournaments = await search(url)
   console.log('tournaments', tournaments)
   if (!tournaments) return false
   let message = '<table>'
   tournaments.map((t) => {
      message += '<tr>'
      message += `<td>${t.date}</td><td>${t.name} (${t.id})</td><td><a href="${t.registration}" target=_blank>Register</a></td>`
      message += '</tr>'
   })
   message += '</table>'

   const emailOptions = getMailOptions({ html: message })
   sendEmail(emailOptions)
}

searchTournaments()
