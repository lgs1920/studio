import axios from 'axios'

export class ChangelogManager {


    CHANGELOG_DIR = '/src/assets/pages/changelog'

    constructor() {
        // Singleton
        if (ChangelogManager.instance) {
            return ChangelogManager.instance
        }
        this.list = this.ls()

        console.log(this.list)
        ChangelogManager.instance = this

    }

    ls = async () => {
        await axios.get('/src/core/ajax/test.js', {
            params: {
                ID: 12345
            }
        })
            .then(function (response) {
                console.log(response);
            })
            .catch(function (error) {
                console.log(error);
            })
            .finally(function () {
                // dans tous les cas
            });
        //return getAllFilesSync(this.CHANGELOG_DIR).toArray()
    }

    whatsNew = () => {
    }
}
