import ctsLogo from '../../assets/images/cts-logo1.png';

function LandingPage() {
    return (
        <div>
            <div style={{display: 'flex', justifyContent: 'center', alignItems: 'center', height: "50vh"}}>
                <img src={ctsLogo} alt="Castaneda Technology Services Logo" style={{maxWidth: 'auto', maxHeight: '100%'}}/>
            </div>
            <div className="intro">
                <p>
                    Welcome to <span className="highlight">Castaneda Technology Services</span>, the digital portfolio of <strong>Emanuel Castaneda</strong>, a visionary Software Engineer driven by the pursuit of innovation and excellence in Artificial Intelligence (AI) and system architecture.
                </p>
                <p>
                    As we delve deeper into the potential of AI, our focus remains steadfast on exploring <strong>Large Language Models (LLMs)</strong> and discovering novel applications that adhere to the highest standards of ethics and safety. This platform not only showcases our endeavors in AI but also serves as a springboard for future projects aimed at integrating these advanced technologies into everyday solutions responsibly.
                </p>
                <p>
                    Explore our work and envision with us the future of ethical AI.
                </p>
            </div>
        </div>
    );
}

export default LandingPage;