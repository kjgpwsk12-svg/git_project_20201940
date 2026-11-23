package com.example.a12th

import android.os.Bundle
import android.widget.ImageView
import android.widget.Toast
import android.widget.ToggleButton
import androidx.activity.enableEdgeToEdge
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

class MainActivity : AppCompatActivity() {
    lateinit var ivBg: ImageView
    lateinit var ivLight1: ImageView
    lateinit var ivLight2: ImageView
    lateinit var ivLight3: ImageView
    lateinit var ivSwitch: ImageView
    lateinit var tbObj1: ToggleButton

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContentView(R.layout.activity_main)
        ViewCompat.setOnApplyWindowInsetsListener(findViewById(R.id.main)) { v, insets ->
            val systemBars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            v.setPadding(systemBars.left, systemBars.top, systemBars.right, systemBars.bottom)
            insets
        }

        ivBg = findViewById(R.id.ivBg)
        ivLight1 = findViewById(R.id.ivLight1)
        ivLight2 = findViewById(R.id.ivLight2)
        ivLight3 = findViewById(R.id.ivLight3)
        ivSwitch = findViewById(R.id.ivSwitch)
        tbObj1 = findViewById(R.id.toggleButton)

        tbObj1.setOnCheckedChangeListener { _, isChecked ->
            if (isChecked) {
                ivBg.setImageResource(R.drawable.bg2)
                ivLight1.setImageResource(R.drawable.light21)
                ivLight2.setImageResource(R.drawable.light22)
                ivLight3.setImageResource(R.drawable.light23)
                ivSwitch.setImageResource(R.drawable.on)
                Toast.makeText(this, "불이 켜졌습니다", Toast.LENGTH_SHORT).show()
            } else {
                ivBg.setImageResource(R.drawable.bg1)
                ivLight1.setImageResource(R.drawable.light11)
                ivLight2.setImageResource(R.drawable.light12)
                ivLight3.setImageResource(R.drawable.light13)
                ivSwitch.setImageResource(R.drawable.off)
                Toast.makeText(this, "불이 꺼졌습니다", Toast.LENGTH_SHORT).show()
            }
        }
    }
}
