import { HOUR, MILLIS } from './AppUtils'

export class UnitUtils {
    /**
     * Converter to metric unit (ie m,s) to other unit.
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
                }
            },
        }
    }
}

/** Units */
export const km = 'km'
export const kmh = 'km/h'
export const mph = 'mph'
export const ft = 'ft'
export const yd = 'yd'
export const inc = 'in'


/** Distance constants to convert from meter */
export const METER = 1
export const FOOT = 3.280839895             // foot
export const KM = 0.001                     // meters
export const KMH = HOUR / MILLIS / KM       // m/s to Km/h
export const MPH = 2.236936                 // m/s to MPH
export const MILE = 0.00062137119223        // miles = MILE * kms
export const YARD = 1.09361                 // meters to yards
export const INCHES = 39.3701              // meters t inches