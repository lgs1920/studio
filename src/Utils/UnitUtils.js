import { MILLIS } from './AppUtils'

export class UnitUtils {
    /**
     * Converter to metric unit (ie m,s) to other unit.
     *
     * How to use :   convert(myValue).to(KM) to convert myValue from meter to kilometers
     *
     * @param input  always in metric based unit
     *
     * @return {{source, to: data.to}}
     */
    static convert = (input) => {
        return {
            source: input,
            to: (unit) => {
                switch (unit) {
                    case km:
                        return input * KM
                    case kmh:
                        return input * KMH
                    case mph:
                        return input * MPH
                    case ft:
                        return input * FOOT
                    case yd:
                        return input * YARD
                    case ft:
                        return input * FOOT
                    case inc:
                        return input * INCHES
                    case hour:
                        return Duration.fromMillis(input * MILLIS).toFormat('hh:mm:ss')
                    case min:
                        return Duration.fromMillis(input * MILLIS).toFormat('mm:ss')
                    default:
                        return unit
                }
            },
        }
    }
}

/** Units */
export const km = 'km'
export const kmh = 'km/h'
export const hkm = 'h/km'
export const mkm = 'm/km'
export const mpkm = 'mpkm'
export const ms = 'm/s'
export const mps = 'mps'
export const sm = 's/m'
export const mph = 'mph'
export const ft = 'ft'
export const yd = 'yd'
export const inc = 'in'
export const hour = 'h'
export const min = 'm'
export const sec = 's'

/** Distance constants to convert from meter */
export const METER = 1
export const FOOT = 3.280839895             // foot
export const KM = 0.001                     // meters
export const KMH = 3.6            // m/s to Km/h
export const MPH = 2.236936                 // m/s to MPH
export const MILE = 0.00062137119223        // miles = MILE * kms
export const YARD = 1.09361                 // meters to yards
export const INCHES = 39.3701              // meters t inches