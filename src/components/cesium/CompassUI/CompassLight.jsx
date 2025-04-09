export const CompactLight = ({dimension, ref}) => {

    if (!dimension) {
        dimension = '100%'
    }

    return (

        // Uploaded to: SVG Repo, www.svgrepo.com, Generator: SVG Repo Mixer Tools

        <svg height={dimension} width={dimension} xmlns="http://www.w3.org/2000/svg"
             xmlnsXlink="http://www.w3.org/1999/xlink"
             viewBox="0 0 512 512" xmlSpace="preserve">
            <g>
                <g className="lgs-compass-needle" ref={ref} style={{rotate: '-45deg', scale: 1.2}}>
                    <path id="north" d="M296.327,296.354l-80.703-80.703l174.962-101.759c9.854-5.731,13.225-2.36,7.494,7.494
					L296.327,296.354z"/>
                    <path id="south" d="M296.327,296.354L121.36,398.108c-9.854,5.731-13.225,2.36-7.494-7.494l101.759-174.962
					L296.327,296.354z"/>
                </g>
                <circle className="lgs-compass-center" cx="255.973" cy="256" r="22.8"/>
            </g>
        </svg>
    )
}