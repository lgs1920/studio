export class ElevationServer {

    static NULL = null
    static NONE = 'none'
    static FILE_CONTENT = 'file-content'

    /**
     * Define some fake elevation servers  for manage some UCs
     *
     * @type {Map<null, {name: string, id: null}>}
     */
    static FAKE_SERVERS = new Map([
                                      [
                                          ElevationServer.NULL, {
                                          'name': 'No Elevation Data',
                                          'id':   ElevationServer.NULL,
                                      },
                                      ],
                                      [
                                          ElevationServer.NONE, {
                                          'name': 'Remove Current Elevation Data',
                                          'id':   ElevationServer.NONE,
                                      },
                                      ],
                                      [
                                          ElevationServer.FILE_CONTENT, {
                                          'name': 'Use File Elevation Data',
                                          'id':   ElevationServer.FILE_CONTENT,
                                      },
                                      ],
                                  ])

    constructor(id) {
        // Get the right info
        this.server = lgs.configuration.AvailableElevationServers.find(server => server.id === id)
    }

    /**
     *
     * @param coordinates = [{lat,lon},...]
     */
    // getElevation = async (coordinates) => {
    //     if (this.server.id !== null) {
    //         // We nee tcut the arry into
    //         let chunks = [];
    //         for (let i = 0; i < ks.length; i += 3000) {
    //             chunks.push(ks.slice(i, i + 3000));
    //         }
    //         // Lancer toutes les promesses en parallèle
    //         let promises = chunks.map(chunk => fetchData(chunk)); // Remplacez ceci par votre fonction de
    // récupération de données  // Attendre que toutes les promesses soient résolues let allData = await
    // Promise.all(promises);  // Ajouter les données à chaque élément du sous-tableau for (let i = 0; i <
    // chunks.length; i++) { chunks[i] = chunks[i].map((item, j) => ({...item, data: allData[i][j]})); }  // Fusionner
    // les sous-tableaux pour obtenir le tableau final let finalArray = [].concat(...chunks); } return null }
}